const assert = require('node:assert/strict');
const test = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');

function loadCsvModule() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib', 'csv.ts'), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  const requireFromModule = require;
  new Function('exports', 'module', 'require', '__filename', '__dirname', output)(
    module.exports,
    module,
    requireFromModule,
    path.join(__dirname, '..', 'lib', 'csv.ts'),
    path.join(__dirname, '..', 'lib'),
  );
  return module.exports;
}

test('CSV escaping quotes commas and protects spreadsheet formulas', () => {
  const { escapeCsvValue, createCsv } = loadCsvModule();

  assert.equal(escapeCsvValue('A, B'), '"A, B"');
  assert.equal(escapeCsvValue('He said "hello"'), '"He said ""hello"""');
  assert.equal(escapeCsvValue('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  assert.equal(
    createCsv([['Student', 'PRN'], ['Jane, Doe', '1246212040']]),
    '"Student","PRN"\r\n"Jane, Doe","1246212040"',
  );
});

test('CSV download clicks an attached link and schedules URL cleanup', async () => {
  const { downloadCsv } = loadCsvModule();
  const originalDocument = global.document;
  const originalWindow = global.window;
  const originalUrl = global.URL;
  const calls = [];
  let downloadBlob;

  global.URL = {
    createObjectURL: blob => {
      downloadBlob = blob;
      calls.push(['create']);
      return 'blob:test-csv';
    },
    revokeObjectURL: url => calls.push(['revoke', url]),
  };
  global.document = {
    body: {
      appendChild(link) {
        link.parentNode = this;
        calls.push(['append', link.download]);
      },
    },
    createElement(tag) {
      assert.equal(tag, 'a');
      return {
        click() {
          assert.equal(this.parentNode, global.document.body);
          calls.push(['click', this.href]);
        },
        remove() {
          calls.push(['remove']);
        },
      };
    },
  };
  global.window = {
    setTimeout(callback, delay) {
      calls.push(['schedule', delay]);
      callback();
    },
  };

  try {
    downloadCsv('grades.csv', [['Student'], ['Jane']]);
    const bytes = new Uint8Array(await downloadBlob.arrayBuffer());
    calls.push(['bom', [...bytes.slice(0, 3)]]);
    calls.push(['content', new TextDecoder().decode(bytes.slice(3))]);

    assert.deepEqual(calls, [
      ['create'],
      ['append', 'grades.csv'],
      ['click', 'blob:test-csv'],
      ['remove'],
      ['schedule', 1000],
      ['revoke', 'blob:test-csv'],
      ['bom', [0xef, 0xbb, 0xbf]],
      ['content', '"Student"\r\n"Jane"'],
    ]);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
    global.URL = originalUrl;
  }
});
