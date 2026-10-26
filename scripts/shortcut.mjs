// Builds the Pushpilot shortcut for Apple Shortcuts (macOS and iOS): push
// links, text, images and files to a Pushbullet device from the Share menu,
// Finder, the menu bar or a keyboard shortcut, with or without the browser
// running. Run with nothing selected, it pushes the clipboard.
//
// The access token is asked for when someone adds the shortcut, so the
// published file holds no secrets. Signing goes through Apple and needs a Mac
// signed in to iCloud.
//
//   node scripts/shortcut.mjs [out-dir]   → <out-dir>/Pushpilot.shortcut (default: site/)
//
// --test builds "Pushpilot Test" for checking with `shortcuts run`: ACCESS_TOKEN
// from .env baked in and no device picker (it pushes to TEST_DEVICE). Never
// publish that one.
//
//   node --env-file=.env scripts/shortcut.mjs --test <out-dir>

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const test = process.argv.includes('--test');
const outDir = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? join(root, 'site');
if (test && !(process.env.ACCESS_TOKEN && process.env.TEST_DEVICE)) throw new Error('--test needs ACCESS_TOKEN and TEST_DEVICE');
const API = 'https://api.pushbullet.com/v2';

// ---------------------------------------------------------------- plist + refs

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function plist(v) {
  if (typeof v === 'string') return `<string>${esc(v)}</string>`;
  if (typeof v === 'boolean') return v ? '<true/>' : '<false/>';
  if (typeof v === 'number') return Number.isInteger(v) ? `<integer>${v}</integer>` : `<real>${v}</real>`;
  if (Array.isArray(v)) return `<array>${v.map(plist).join('')}</array>`;
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return `<dict>${entries.map(([k, x]) => `<key>${esc(k)}</key>${plist(x)}`).join('')}</dict>`;
}

const uuid = () => randomUUID().toUpperCase();
const ShortcutInput = { Type: 'ExtensionInput' };
const RepeatItem = { Type: 'Variable', VariableName: 'Repeat Item' };
const variable = (name) => ({ Type: 'Variable', VariableName: name });
const asFile = { Type: 'WFCoercionVariableAggrandizement', CoercionItemClass: 'WFGenericFileContentItem' };
const fileName = { Type: 'WFPropertyVariableAggrandizement', PropertyName: 'Name', PropertyUserInfo: 'WFItemName' };
const fileExtension = {
  Type: 'WFPropertyVariableAggrandizement',
  PropertyName: 'File Extension',
  PropertyUserInfo: 'WFFileExtensionProperty',
};
const dictKey = (key) => ({ Type: 'WFDictionaryValueVariableAggrandizement', DictionaryKey: key });
const withAggr = (ref, ...Aggrandizements) => ({ ...ref, Aggrandizements });

/** A single variable or action output, as an action's input. */
const attach = (ref) => ({ Value: ref, WFSerializationType: 'WFTextTokenAttachment' });

/** Text with variables in it: text('Pushed to ', variable('Choice')). */
function text(...parts) {
  let string = '';
  const attachmentsByRange = {};
  for (const p of parts) {
    if (typeof p === 'string') string += p;
    else {
      attachmentsByRange[`{${string.length}, 1}`] = p;
      string += '￼';
    }
  }
  return { Value: { string, attachmentsByRange }, WFSerializationType: 'WFTextTokenString' };
}

/** Header, JSON body or form fields: [[key, value], …]; a value is a string, a ref, text(…), or { file: ref }. */
function fields(pairs) {
  return {
    Value: {
      WFDictionaryFieldValueItems: pairs.map(([key, value]) =>
        value?.file
          ? {
              WFItemType: 5,
              WFKey: text(key),
              WFValue: { Value: attach(value.file), WFSerializationType: 'WFTokenAttachmentParameterState' },
            }
          : { WFItemType: 0, WFKey: text(key), WFValue: value.WFSerializationType ? value : text(value) },
      ),
    },
    WFSerializationType: 'WFDictionaryFieldValue',
  };
}

// ---------------------------------------------------------------- actions

const actions = [];

function act(id, params = {}, name = id) {
  const UUID = uuid();
  actions.push({ WFWorkflowActionIdentifier: `is.workflow.actions.${id}`, WFWorkflowActionParameters: { UUID, ...params } });
  return { Type: 'ActionOutput', OutputUUID: UUID, OutputName: name };
}

const setVar = (name, ref) => act('setvariable', { WFVariableName: name, WFInput: attach(ref) });
const setText = (name, ...parts) => setVar(name, act('gettext', { WFTextActionText: text(...parts) }, 'Text'));
const value = (dict, key) => act('getvalueforkey', { WFInput: attach(dict), WFDictionaryKey: key }, 'Dictionary Value');
const match = (input, pattern) =>
  act('text.match', { text: text(input), WFMatchTextPattern: pattern, WFMatchTextCaseSensitive: false }, 'Matches');

const auth = () => fields([['Access-Token', variable('Token')]]);
const post = (url, body) =>
  act(
    'downloadurl',
    {
      WFURL: url,
      WFHTTPMethod: 'POST',
      WFHTTPHeaders: auth(),
      WFHTTPBodyType: 'JSON',
      WFJSONValues: fields(body),
      Advanced: true,
    },
    'Contents of URL',
  );

const IS = 4;
const CONTAINS = 99;
const HAS_VALUE = 100;

function when(input, condition, compareTo, then, otherwise) {
  const GroupingIdentifier = uuid();
  act('conditional', {
    GroupingIdentifier,
    WFControlFlowMode: 0,
    WFCondition: condition,
    WFInput: { Type: 'Variable', Variable: attach(input) },
    WFConditionalActionString: compareTo,
  });
  then();
  if (otherwise) {
    act('conditional', { GroupingIdentifier, WFControlFlowMode: 1 });
    otherwise();
  }
  act('conditional', { GroupingIdentifier, WFControlFlowMode: 2 });
}

function forEach(input, body) {
  const GroupingIdentifier = uuid();
  act('repeat.each', { GroupingIdentifier, WFControlFlowMode: 0, WFInput: attach(input) });
  body();
  act('repeat.each', { GroupingIdentifier, WFControlFlowMode: 2 });
}

function stopWithAlert(...message) {
  act('alert', {
    WFAlertActionTitle: 'Pushpilot',
    WFAlertActionMessage: text(...message),
    WFAlertActionCancelButtonShown: false,
  });
  act('exit');
}

// ---------------------------------------------------------------- the shortcut

// 1. The access token, filled in by the import question (action 0).
setVar('Token', act('gettext', { WFTextActionText: test ? process.env.ACCESS_TOKEN : '' }, 'Text'));

// 2. Devices that can receive pushes, as "name → iden", after "All devices".
const devices = act(
  'downloadurl',
  { WFURL: `${API}/devices?active=true`, WFHTTPMethod: 'GET', WFHTTPHeaders: auth(), Advanced: true },
  'Contents of URL',
);
const error = value(devices, 'error');
when(error, HAS_VALUE, undefined, () =>
  stopWithAlert(
    'Pushbullet didn’t accept the access token: ',
    value(error, 'message'),
    '\n\nEdit the shortcut and paste a new token from pushbullet.com › Settings › Account.',
  ),
);
setVar('Targets', act('dictionary', { WFItems: fields([['All devices', 'all']]) }, 'Dictionary'));
forEach(value(devices, 'devices'), () => {
  // Pushbullet keeps old registrations that never receive anything (pushable: false).
  // Matching the value as text works however Shortcuts spells a boolean.
  const pushable = match(value(RepeatItem, 'pushable'), '^(1|yes|true)$');
  // Two devices with one name: keep the first, the most recently added.
  const taken = () => value(variable('Targets'), text(value(RepeatItem, 'nickname')));
  when(pushable, HAS_VALUE, undefined, () =>
    when(
      taken(),
      HAS_VALUE,
      undefined,
      () => {},
      () => {
        const updated = act(
          'setvalueforkey',
          {
            WFDictionary: attach(variable('Targets')),
            WFDictionaryKey: text(value(RepeatItem, 'nickname')),
            WFDictionaryValue: text(value(RepeatItem, 'iden')),
          },
          'Dictionary',
        );
        setVar('Targets', updated);
      },
    ),
  );
});

// 3. Pick where to push.
const names = act(
  'getvalueforkey',
  { WFInput: attach(variable('Targets')), WFGetDictionaryValueType: 'All Keys' },
  'Dictionary Value',
);
if (test) {
  setText('Choice', 'the test device');
  setText('Target', process.env.TEST_DEVICE);
} else {
  setVar('Choice', act('choosefromlist', { WFInput: attach(names), WFChooseFromListActionPrompt: 'Push to' }, 'Chosen Item'));
  setVar('Target', value(variable('Targets'), text(variable('Choice'))));
}
setText('Failed', '');

// 4. Push each shared item (or the clipboard): links, text as a note, anything else as a file.
forEach(ShortcutInput, () => {
  for (const name of ['Type', 'Url', 'Body', 'FileName', 'FileType', 'FileUrl']) setText(name, '');
  const kind = act('getitemtype', { WFInput: attach(RepeatItem) }, 'Type');

  when(
    kind,
    IS,
    'URL',
    () => {
      setText('Type', 'link');
      setText('Url', RepeatItem);
    },
    () =>
      // "Text" and "Rich text"
      when(
        kind,
        CONTAINS,
        'ext',
        () => {
          const body = act('gettext', { WFTextActionText: text(RepeatItem) }, 'Text');
          when(
            match(body, '^\\s*(https?://|www\\.)\\S+\\s*$'),
            HAS_VALUE,
            undefined,
            () => {
              setText('Type', 'link');
              setText('Url', match(body, '(https?://|www\\.)\\S+'));
            },
            () => {
              setText('Type', 'note');
              setText('Body', body);
            },
          );
        },
        () => {
          // Photos share HEIC, which most phones can't show; send those as JPEG.
          const ext = withAggr(RepeatItem, fileExtension);
          when(
            match(ext, '^hei[cf]$'),
            HAS_VALUE,
            undefined,
            () =>
              setVar(
                'File',
                act(
                  'image.convert',
                  { WFInput: attach(RepeatItem), WFImageFormat: 'JPEG', WFImageCompressionQuality: 0.9 },
                  'Converted Image',
                ),
              ),
            () => setVar('File', RepeatItem),
          );
          const name = withAggr(variable('File'), fileName);
          const extension = withAggr(variable('File'), fileExtension);
          // Pushbullet works out the type from the name, then takes the upload.
          const ticket = act(
            'detect.dictionary',
            { WFInput: attach(post(`${API}/upload-request`, [['file_name', text(name, '.', extension)]])) },
            'Dictionary',
          );
          act(
            'downloadurl',
            {
              WFURL: text(withAggr(ticket, dictKey('upload_url'))),
              WFHTTPMethod: 'POST',
              WFHTTPBodyType: 'Form',
              WFFormValues: fields([['file', { file: withAggr(variable('File'), asFile) }]]),
              Advanced: true,
            },
            'Contents of URL',
          );
          setText('Type', 'file');
          setText('FileName', withAggr(ticket, dictKey('file_name')));
          setText('FileType', withAggr(ticket, dictKey('file_type')));
          setText('FileUrl', withAggr(ticket, dictKey('file_url')));
        },
      ),
  );

  // Empty fields are ignored by Pushbullet, so one request covers every type.
  const push = [
    ['type', variable('Type')],
    ['url', variable('Url')],
    ['body', variable('Body')],
    ['file_name', variable('FileName')],
    ['file_type', variable('FileType')],
    ['file_url', variable('FileUrl')],
  ];
  when(
    variable('Target'),
    IS,
    'all',
    () => setVar('Result', post(`${API}/pushes`, push)),
    () => setVar('Result', post(`${API}/pushes`, [...push, ['device_iden', variable('Target')]])),
  );
  const failure = value(variable('Result'), 'error');
  when(failure, HAS_VALUE, undefined, () => {
    setText('Failed', 'yes');
    act('notification', {
      WFNotificationActionTitle: 'Couldn’t push',
      WFNotificationActionBody: text(value(failure, 'message')),
    });
  });
});

when(
  variable('Failed'),
  HAS_VALUE,
  undefined,
  () => {},
  () =>
    act('notification', {
      WFNotificationActionTitle: 'Pushpilot',
      WFNotificationActionBody: text('Pushed to ', variable('Choice')),
    }),
);

// ---------------------------------------------------------------- write + sign

const shortcut = {
  WFWorkflowClientVersion: '3218.0.4.100',
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: '900',
  WFWorkflowIcon: { WFWorkflowIconStartColor: 4292093695, WFWorkflowIconGlyphNumber: 59708 },
  WFWorkflowTypes: ['ActionExtension', 'QuickActions', 'MenuBar', 'WFWorkflowTypeShowInSearch'],
  WFQuickActionSurfaces: ['Finder', 'Services'],
  WFWorkflowInputContentItemClasses: [
    'WFURLContentItem',
    'WFStringContentItem',
    'WFRichTextContentItem',
    'WFImageContentItem',
    'WFPDFContentItem',
    'WFAVAssetContentItem',
    'WFGenericFileContentItem',
  ],
  WFWorkflowHasShortcutInputVariables: true,
  WFWorkflowNoInputBehavior: { Name: 'WFWorkflowNoInputBehaviorGetClipboard', Parameters: {} },
  WFWorkflowOutputContentItemClasses: [],
  WFWorkflowImportQuestions: test
    ? []
    : [
        {
          ActionIndex: 0,
          Category: 'Parameter',
          ParameterKey: 'WFTextActionText',
          DefaultValue: '',
          Text: 'Paste your Pushbullet access token. Create one at pushbullet.com › Settings › Account › Create Access Token. It stays in this shortcut on your devices.',
        },
      ],
  WFWorkflowActions: actions,
};

const work = mkdtempSync(join(tmpdir(), 'pushpilot-shortcut-'));
try {
  const xml = join(work, 'Pushpilot.xml');
  const unsigned = join(work, 'Pushpilot-unsigned.shortcut');
  writeFileSync(
    xml,
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">${plist(shortcut)}</plist>\n`,
  );
  execFileSync('plutil', ['-convert', 'binary1', '-o', unsigned, xml]);
  const out = join(outDir, test ? 'Pushpilot Test.shortcut' : 'Pushpilot.shortcut');
  // Apple's signing service fails now and then (HTTP 500); a retry usually goes through.
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync('shortcuts', ['sign', '--mode', 'anyone', '--input', unsigned, '--output', out], { stdio: 'pipe' });
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      execFileSync('sleep', ['3']);
    }
  }
  console.log(`${actions.length} actions → ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
