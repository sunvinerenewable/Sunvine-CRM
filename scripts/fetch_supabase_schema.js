import fs from 'fs';

const supabaseUrl = 'https://wyberzvcyrjipjqpotwe.supabase.co';
const supabaseKey = 'sb_publishable_XzbS-fQMtSGf2LjFO40yzw_LtT98nG6';

async function fetchOpenApiSchema() {
  console.log('Fetching OpenAPI schema from Supabase PostgREST endpoint...');
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    console.log('Status:', response.status, response.statusText);

    if (!response.ok) {
      const text = await response.text();
      console.log('Error response:', text);
      return;
    }

    const schema = await response.json();
    console.log('API Title:', schema.info?.title);
    console.log('Definitions/Tables in Schema:');
    
    const definitions = schema.definitions || {};
    const tables = Object.keys(definitions);
    console.log(`Found ${tables.length} tables/definitions in Supabase:`, tables);

    const report = {
      supabaseUrl,
      tableCount: tables.length,
      tables: {}
    };

    for (const tableName of tables) {
      const def = definitions[tableName];
      const properties = def.properties || {};
      const columns = Object.keys(properties).map(col => ({
        name: col,
        type: properties[col].type,
        format: properties[col].format,
        description: properties[col].description,
        default: properties[col].default
      }));

      // Fetch row count and sample rows for this table
      let rowCount = 0;
      let sampleRows = [];
      let fetchError = null;

      try {
        const rowsRes = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=*&limit=5`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact'
          }
        });

        const countHeader = rowsRes.headers.get('content-range');
        if (countHeader && countHeader.includes('/')) {
          const total = countHeader.split('/')[1];
          rowCount = total === '*' ? 0 : parseInt(total, 10);
        }

        if (rowsRes.ok) {
          sampleRows = await rowsRes.json();
          if (!countHeader) {
            rowCount = sampleRows.length;
          }
        } else {
          fetchError = await rowsRes.text();
        }
      } catch (err) {
        fetchError = err.message;
      }

      report.tables[tableName] = {
        columnCount: columns.length,
        required: def.required || [],
        columns,
        rowCount,
        sampleRows,
        fetchError
      };
    }

    fs.writeFileSync('./scripts/supabase_schema_report.json', JSON.stringify(report, null, 2));
    console.log('Report saved to ./scripts/supabase_schema_report.json');

  } catch (err) {
    console.error('Fetch error:', err);
  }
}

fetchOpenApiSchema();
