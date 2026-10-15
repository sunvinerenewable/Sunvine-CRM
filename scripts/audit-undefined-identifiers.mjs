import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';

const KNOWN_GLOBALS = new Set([
  'window', 'document', 'navigator', 'console', 'localStorage', 'sessionStorage',
  'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FormData',
  'Intl', 'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'RegExp',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'Symbol', 'BigInt', 'ArrayBuffer', 'Uint8Array', 'Uint16Array', 'Uint32Array',
  'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'DataView',
  'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'undefined', 'NaN', 'Infinity', 'process', 'global', 'globalThis',
  'crypto', 'btoa', 'atob', 'alert', 'confirm', 'prompt', 'location', 'history', 'customElements',
  'Image', 'Audio', 'Notification', 'ServiceWorker', 'Worker', 'Event', 'CustomEvent', 'MessageChannel',
  'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'Performance', 'performance',
  'HTMLCanvasElement', 'CanvasRenderingContext2D', 'WebGLRenderingContext', 'AbortController',
  'Headers', 'Request', 'Response', 'TextEncoder', 'TextDecoder', 'Proxy', 'Reflect',
  'unescape', 'escape', 'screen', 'BroadcastChannel', 'FileList', 'caches'
]);

function getSourceFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== '__tests__') {
        files = files.concat(getSourceFiles(full));
      }
    } else if (e.isFile() && (e.name.endsWith('.jsx') || e.name.endsWith('.js'))) {
      files.push(full);
    }
  }
  return files;
}

function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });
  } catch (err) {
    return [{ line: 1, name: 'SYNTAX_ERROR', message: err.message }];
  }

  const scopes = [];

  function enterScope() {
    scopes.push(new Set());
  }

  function exitScope() {
    scopes.pop();
  }

  function declare(name) {
    if (name && scopes.length > 0) {
      scopes[scopes.length - 1].add(name);
    }
  }

  function isDeclared(name) {
    if (KNOWN_GLOBALS.has(name)) return true;
    for (let i = scopes.length - 1; i >= 0; i--) {
      if (scopes[i].has(name)) return true;
    }
    return false;
  }

  const undefinedRefs = [];

  function extractPattern(patternNode, callback) {
    if (!patternNode) return;
    if (patternNode.type === 'Identifier') {
      callback(patternNode.name);
    } else if (patternNode.type === 'AssignmentPattern') {
      extractPattern(patternNode.left, callback);
    } else if (patternNode.type === 'RestElement') {
      extractPattern(patternNode.argument, callback);
    } else if (patternNode.type === 'ObjectPattern') {
      for (const prop of patternNode.properties) {
        if (prop.type === 'ObjectProperty') {
          extractPattern(prop.value, callback);
        } else if (prop.type === 'RestElement') {
          extractPattern(prop.argument, callback);
        }
      }
    } else if (patternNode.type === 'ArrayPattern') {
      for (const elem of patternNode.elements) {
        if (elem) extractPattern(elem, callback);
      }
    }
  }

  // Pre-pass: collect all top-level declarations and hoisted functions
  enterScope(); // Program scope
  for (const stmt of ast.program.body) {
    if (stmt.type === 'ImportDeclaration') {
      for (const spec of stmt.specifiers) {
        declare(spec.local.name);
      }
    } else if (stmt.type === 'FunctionDeclaration') {
      if (stmt.id?.name) declare(stmt.id.name);
    } else if (stmt.type === 'ClassDeclaration') {
      if (stmt.id?.name) declare(stmt.id.name);
    } else if (stmt.type === 'VariableDeclaration') {
      for (const decl of stmt.declarations) {
        extractPattern(decl.id, declare);
      }
    } else if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.declaration) {
        if (stmt.declaration.type === 'FunctionDeclaration' && stmt.declaration.id?.name) {
          declare(stmt.declaration.id.name);
        } else if (stmt.declaration.type === 'VariableDeclaration') {
          for (const decl of stmt.declaration.declarations) {
            extractPattern(decl.id, declare);
          }
        }
      }
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      if (stmt.declaration?.type === 'FunctionDeclaration' && stmt.declaration.id?.name) {
        declare(stmt.declaration.id.name);
      } else if (stmt.declaration?.type === 'ClassDeclaration' && stmt.declaration.id?.name) {
        declare(stmt.declaration.id.name);
      }
    }
  }

  // Walk inner AST
  function walk(node, parent) {
    if (!node || typeof node !== 'object') return;
    if (node === ast.program) {
      for (const child of node.body) walk(child, node);
      return;
    }

    let createdScope = false;

    if (
      node.type === 'FunctionDeclaration' ||
      node.type === 'FunctionExpression' ||
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'ObjectMethod' ||
      node.type === 'ClassMethod' ||
      node.type === 'BlockStatement' ||
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'CatchClause'
    ) {
      enterScope();
      createdScope = true;
    }

    // Pre-hoist functions in block scopes
    if (node.type === 'BlockStatement' && Array.isArray(node.body)) {
      for (const item of node.body) {
        if (item.type === 'FunctionDeclaration' && item.id?.name) {
          declare(item.id.name);
        }
      }
    }

    // Process declarations
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression' || node.type === 'ObjectMethod' || node.type === 'ClassMethod') {
      if (node.id?.name) declare(node.id.name);
      if (node.params) {
        for (const p of node.params) extractPattern(p, declare);
      }
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        extractPattern(decl.id, declare);
      }
    } else if (node.type === 'CatchClause') {
      if (node.param) extractPattern(node.param, declare);
    }

    // Check Identifiers (usages)
    if (node.type === 'Identifier') {
      const isPropOfMember = (parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression') && parent.property === node && !parent.computed;
      const isKeyOfProp = (parent?.type === 'ObjectProperty' || parent?.type === 'ObjectMethod' || parent?.type === 'ClassProperty' || parent?.type === 'PropertyDefinition') && parent.key === node && !parent.computed && !parent.shorthand;
      const isMethodKey = (parent?.type === 'ClassMethod' || parent?.type === 'ObjectMethod') && parent.key === node && !parent.computed;
      const isImport = parent?.type?.startsWith('Import');
      const isDeclaration = parent?.type === 'VariableDeclarator' && parent.id === node;
      const isFnParam = (parent?.type === 'FunctionDeclaration' || parent?.type === 'FunctionExpression' || parent?.type === 'ArrowFunctionExpression' || parent?.type === 'ObjectMethod' || parent?.type === 'ClassMethod') && parent.params?.includes(node);
      const isLabel = parent?.type === 'LabeledStatement' || parent?.type === 'BreakStatement' || parent?.type === 'ContinueStatement';
      const isExportSpec = parent?.type === 'ExportSpecifier';
      const isMetaProperty = parent?.type === 'MetaProperty';

      if (!isPropOfMember && !isKeyOfProp && !isMethodKey && !isImport && !isDeclaration && !isFnParam && !isLabel && !isExportSpec && !isMetaProperty) {
        if (!isDeclared(node.name)) {
          undefinedRefs.push({
            name: node.name,
            line: node.loc?.start?.line || 0,
            column: node.loc?.start?.column || 0
          });
        }
      }
    } else if (node.type === 'JSXIdentifier') {
      const isClosing = parent?.type === 'JSXClosingElement';
      const isAttr = parent?.type === 'JSXAttribute';
      const isMember = parent?.type === 'JSXMemberExpression';
      if (!isClosing && !isAttr && !isMember && parent?.type === 'JSXOpeningElement' && parent.name === node) {
        if (/^[A-Z]/.test(node.name)) {
          if (!isDeclared(node.name)) {
            undefinedRefs.push({
              name: node.name,
              line: node.loc?.start?.line || 0,
              column: node.loc?.start?.column || 0
            });
          }
        }
      }
    }

    // Walk children
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'comments' || key === 'leadingComments' || key === 'trailingComments') continue;
      const val = node[key];
      if (Array.isArray(val)) {
        for (const child of val) walk(child, node);
      } else if (val && typeof val === 'object' && val.type) {
        walk(val, node);
      }
    }

    if (createdScope) {
      exitScope();
    }
  }

  walk(ast.program, null);
  exitScope(); // Exit Program scope
  return undefinedRefs;
}

const files = getSourceFiles('src');
console.log(`Auditing ${files.length} source files in src/...`);

let errorCount = 0;
for (const file of files) {
  const issues = analyzeFile(file);
  const relPath = path.relative('.', file).replace(/\\/g, '/');
  if (issues.length > 0) {
    console.log(`\n❌ ${relPath}:`);
    for (const iss of issues) {
      console.log(`   Line ${iss.line}: '${iss.name}' is NOT defined`);
      errorCount++;
    }
  }
}

if (errorCount === 0) {
  console.log('\n✅ 0 undefined identifiers found across the entire src/ codebase!');
} else {
  console.log(`\n🚨 Total: ${errorCount} undefined identifier reference(s) found!`);
}
