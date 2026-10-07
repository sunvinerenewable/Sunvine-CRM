/**
 * item9-repo-hygiene.test.js — Verification tests for Round 4 Item 9
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('ITEM-9: .gitignore and .git/info/exclude contain sensitive files', () => {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const excludePath = path.resolve(process.cwd(), '.git/info/exclude');

  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  assert.match(gitignore, /PRE_LAUNCH_CHANGES_AND_TESTING_GUIDE\.md/i);
  assert.match(gitignore, /supabase\/config\.toml/i);

  if (fs.existsSync(excludePath)) {
    const exclude = fs.readFileSync(excludePath, 'utf8');
    assert.match(exclude, /PRE_LAUNCH_CHANGES_AND_TESTING_GUIDE\.md/i);
    assert.match(exclude, /supabase\/config\.toml/i);
  }
});
