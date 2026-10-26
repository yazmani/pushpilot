// Builds the Pushpilot shortcut for Apple Shortcuts on iPhone, iPad and Mac:
// push links, text, photos and files to a Pushbullet device or friend from the
// Share sheet, Finder, the menu bar, Back Tap, Siri or a keyboard shortcut,
// with or without the browser running. With nothing shared it pushes the
// clipboard. The list starts with wherever you pushed last (read from your
// recent pushes), and you can set one device to skip it.
//
// The access token is asked for when someone adds the shortcut, so the
// published file holds no secrets. Signing goes through Apple and needs a Mac
// signed in to iCloud.
//
//   node scripts/shortcut.mjs [out-dir]   → <out-dir>/Pushpilot.shortcut (default: site/)
//
// --test builds "Pushpilot Test" for checking with `shortcuts run`: ACCESS_TOKEN
// from .env baked in, no "All devices", the first entry of the list picked
// instead of asking, and checkpoint notes pushed to TEST_DEVICE as it runs.
// Push something to TEST_DEVICE first so it's the first entry. Never publish
// that one.
//
//   TEST_DEVICE=<iden> node --env-file=.env scripts/shortcut.mjs --test <out-dir>

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
const append = (name, ref) => act('appendvariable', { WFVariableName: name, WFInput: attach(ref) });
const dictionary = (pairs) => act('dictionary', { WFItems: fields(pairs) }, 'Dictionary');
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

// Note: in Shortcuts, empty text still "has any value", and checking a variable
// that was never set, looking up an empty key or comparing against empty text all
// stop the run. So "nothing yet" is the placeholder NONE, and keys get a prefix.
// (NONE has to read as text: an "is" check on something like "-" also stops it.)
const NONE = 'nothing yet';
const IS = 4;
const BEGINS_WITH = 8;
const CONTAINS = 99;
const HAS_VALUE = 100;
const HAS_NO_VALUE = 101;

const asText = { Type: 'WFCoercionVariableAggrandizement', CoercionItemClass: 'WFStringContentItem' };

function when(input, condition, compareTo, then, otherwise) {
  const GroupingIdentifier = uuid();
  // Text comparisons on a value Shortcuts can't type (a dictionary value, say)
  // stop the run, so compare it explicitly as text.
  const compared = compareTo === undefined ? input : withAggr(input, ...(input.Aggrandizements ?? []), asText);
  act('conditional', {
    GroupingIdentifier,
    WFControlFlowMode: 0,
    WFCondition: condition,
    WFInput: { Type: 'Variable', Variable: attach(compared) },
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

/** Test builds only: a note to TEST_DEVICE marking how far a run got. */
function checkpoint(...parts) {
  if (!test) return;
  post(`${API}/pushes`, [
    ['type', 'note'],
    ['body', text('checkpoint ', ...parts)],
    ['device_iden', process.env.TEST_DEVICE],
  ]);
}

// ---------------------------------------------------------------- the shortcut

const ALL = '🌐 All devices';
const ASK = 'Ask every time';

// Device types as Pushbullet reports them (icon first, then type).
const KINDS = {
  phone: ['📱', 'Phone'],
  iphone: ['📱', 'Phone'],
  android: ['📱', 'Phone'],
  ios: ['📱', 'Phone'],
  tablet: ['📱', 'Tablet'],
  ipad: ['📱', 'Tablet'],
  watch: ['⌚', 'Watch'],
  browser: ['💻', 'Browser'],
  chrome: ['💻', 'Browser'],
  firefox: ['💻', 'Browser'],
  opera: ['💻', 'Browser'],
  safari: ['💻', 'Browser'],
  laptop: ['💻', 'Laptop'],
  desktop: ['🖥️', 'Computer'],
  system: ['🖥️', 'Computer'],
  windows: ['🖥️', 'Computer'],
  mac: ['🖥️', 'Computer'],
  website: ['🌐', 'Website'],
};

// 1. Settings, filled in by the import questions.
const TOKEN_ACTION = actions.length;
setVar('Token', act('gettext', { WFTextActionText: test ? process.env.ACCESS_TOKEN : '' }, 'Text'));
const DEVICE_ACTION = actions.length;
setVar('Fixed', act('gettext', { WFTextActionText: ASK }, 'Text'));
checkpoint('start');

when(ShortcutInput, HAS_NO_VALUE, undefined, () =>
  stopWithAlert('Nothing to push. Share a link, text, photo or file with Pushpilot, or copy something first.'),
);

// 2. Everything you can push to. Each entry has a label for the list ("📱 Pixel 8 ·
//    Phone"), a target ("all", "d:<device>", "e:<friend's email>") and a plain name.
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
checkpoint('devices fetched');
// The test build starts with an entry Pushbullet rejects instead of "All devices",
// so a mix-up can't push to real devices.
const first = test ? ['⚠️ test guard', 'd:none', 'none', 'test guard'] : [ALL, 'all', 'all', 'All devices'];
setVar('Targets', dictionary([[first[0], first[1]]])); // label → "all" | "d:…" | "e:…"
setVar('Ids', dictionary([[first[0], first[2]]])); // label → device iden or email
setVar('Names', dictionary([[first[0], first[3]]])); // label → plain name
setVar('Labels', dictionary([[`n:${first[3]}`, first[0]]])); // "n:" + plain name → label
setVar('Codes', dictionary([[first[1], first[0]]])); // target → label
const emoji = dictionary(Object.entries(KINDS).map(([k, [e]]) => [`k:${k}`, e]));
const kinds = dictionary(Object.entries(KINDS).map(([k, [, kind]]) => [`k:${k}`, kind]));

/** Adds the entry in Label/Name unless the name is taken (two devices with one name: the first, newest, wins). */
function addTarget(prefix, id) {
  when(
    value(variable('Labels'), text('n:', variable('Name'))),
    HAS_VALUE,
    undefined,
    () => {},
    () => {
      const put = (dict, key, val) =>
        setVar(
          dict,
          act(
            'setvalueforkey',
            { WFDictionary: attach(variable(dict)), WFDictionaryKey: key, WFDictionaryValue: val },
            'Dictionary',
          ),
        );
      setText('Id', id);
      put('Targets', text(variable('Label')), text(prefix, variable('Id')));
      put('Ids', text(variable('Label')), text(variable('Id')));
      put('Names', text(variable('Label')), text(variable('Name')));
      put('Labels', text('n:', variable('Name')), text(variable('Label')));
      put('Codes', text(prefix, variable('Id')), text(variable('Label')));
    },
  );
}

forEach(value(devices, 'devices'), () => {
  // Pushbullet keeps old registrations that never receive anything (pushable: false).
  // Matching the value as text works however Shortcuts spells a boolean.
  when(match(value(RepeatItem, 'pushable'), '^(1|yes|true)$'), HAS_VALUE, undefined, () => {
    const nickname = value(RepeatItem, 'nickname');
    when(
      nickname,
      HAS_VALUE,
      undefined,
      () => setText('Name', nickname),
      () => setText('Name', 'Unnamed device'),
    );
    setText('Kind', 'k:', value(RepeatItem, 'type'));
    const icon = value(RepeatItem, 'icon');
    when(icon, HAS_VALUE, undefined, () =>
      when(value(kinds, text('k:', icon)), HAS_VALUE, undefined, () => setText('Kind', 'k:', icon)),
    );
    const kind = value(kinds, text(variable('Kind')));
    when(
      kind,
      HAS_VALUE,
      undefined,
      () => setText('Label', value(emoji, text(variable('Kind'))), ' ', variable('Name'), ' · ', kind),
      () => setText('Label', variable('Name')),
    );
    addTarget('d:', value(RepeatItem, 'iden'));
  });
});
checkpoint('devices listed');

const chats = act(
  'downloadurl',
  { WFURL: `${API}/chats?active=true`, WFHTTPMethod: 'GET', WFHTTPHeaders: auth(), Advanced: true },
  'Contents of URL',
);
forEach(value(chats, 'chats'), () => {
  const friend = value(RepeatItem, 'with');
  const friendName = value(friend, 'name');
  when(
    friendName,
    HAS_VALUE,
    undefined,
    () => setText('Name', friendName),
    () => setText('Name', value(friend, 'email')),
  );
  setText('Label', '👤 ', variable('Name'), ' · Friend');
  addTarget('e:', value(friend, 'email'));
});
checkpoint('friends listed');

// 3. Where to push: the device set when adding the shortcut, or a list that starts
//    with wherever you pushed last (from any app), read from your recent pushes.
const fixed = value(variable('Labels'), text('n:', variable('Fixed')));
when(
  fixed,
  HAS_VALUE,
  undefined,
  () => setText('Choice', fixed),
  () => {
    const recent = act(
      'downloadurl',
      { WFURL: `${API}/pushes?active=true&limit=10`, WFHTTPMethod: 'GET', WFHTTPHeaders: auth(), Advanced: true },
      'Contents of URL',
    );
    setText('Last', NONE);
    const pushes = value(recent, 'pushes');
    forEach(pushes, () => {
      when(variable('Last'), IS, NONE, () => {
        when(
          value(RepeatItem, 'direction'),
          IS,
          'incoming',
          () => {},
          () => {
            when(
              value(RepeatItem, 'target_device_iden'),
              HAS_VALUE,
              undefined,
              () => setText('Code', 'd:', value(RepeatItem, 'target_device_iden')),
              () =>
                when(
                  value(RepeatItem, 'direction'),
                  IS,
                  'outgoing',
                  () => setText('Code', 'e:', value(RepeatItem, 'receiver_email')),
                  () => setText('Code', 'all'),
                ),
            );
            // Nothing for a device that's gone, so the next push is tried.
            const hit = value(variable('Codes'), text(variable('Code')));
            when(hit, HAS_VALUE, undefined, () => setText('Last', hit));
          },
        );
      });
    });
    checkpoint('last: ', variable('Last'));
    const labels = act(
      'getvalueforkey',
      { WFInput: attach(variable('Targets')), WFGetDictionaryValueType: 'All Keys' },
      'Dictionary Value',
    );
    when(
      variable('Last'),
      IS,
      NONE,
      () => setVar('Ordered', labels),
      () => {
        append('Ordered', variable('Last'));
        forEach(labels, () =>
          when(
            RepeatItem,
            IS,
            text(variable('Last')),
            () => {},
            () => append('Ordered', RepeatItem),
          ),
        );
      },
    );
    checkpoint('ordered');
    setText(
      'Choice',
      test
        ? act('getitemfromlist', { WFInput: attach(variable('Ordered')), WFItemSpecifier: 'First Item' }, 'Item from List')
        : act('choosefromlist', { WFInput: attach(variable('Ordered')), WFChooseFromListActionPrompt: 'Push to' }, 'Chosen Item'),
    );
  },
);
setText('Target', value(variable('Targets'), text(variable('Choice'))));
setText('TargetId', value(variable('Ids'), text(variable('Choice'))));
setText('Display', value(variable('Names'), text(variable('Choice'))));
setText('Pushed', NONE);
checkpoint('target: ', variable('Choice'), ' → ', variable('Target'), ' / ', variable('TargetId'));

// 4. Push each shared item (or the clipboard): links, text as a note, anything else as a file.
forEach(ShortcutInput, () => {
  for (const name of ['Type', 'Url', 'Body', 'FileName', 'FileType', 'FileUrl']) setText(name, '');
  const kind = act('getitemtype', { WFInput: attach(RepeatItem) }, 'Type');
  checkpoint('item: ', kind);

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
    () =>
      when(
        variable('Target'),
        BEGINS_WITH,
        'e:',
        () => setVar('Result', post(`${API}/pushes`, [...push, ['email', variable('TargetId')]])),
        () => setVar('Result', post(`${API}/pushes`, [...push, ['device_iden', variable('TargetId')]])),
      ),
  );
  const failure = value(variable('Result'), 'error');
  when(
    failure,
    HAS_VALUE,
    undefined,
    () =>
      act('notification', {
        WFNotificationActionTitle: 'Couldn’t push',
        WFNotificationActionBody: text(value(failure, 'message')),
      }),
    // Only one of Url, Body and FileName is set for each item.
    () =>
      when(
        variable('Pushed'),
        IS,
        NONE,
        () => setText('Pushed', variable('Url'), variable('Body'), variable('FileName')),
        () => setText('Pushed', variable('Pushed'), ', ', variable('Url'), variable('Body'), variable('FileName')),
      ),
  );
});

when(
  variable('Pushed'),
  IS,
  NONE,
  () => {},
  () =>
    act('notification', {
      WFNotificationActionTitle: text('Pushed to ', variable('Display')),
      WFNotificationActionBody: text(variable('Pushed')),
    }),
);

// ---------------------------------------------------------------- write + sign

const shortcut = {
  WFWorkflowClientVersion: '3218.0.4.100',
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: '900',
  // Green, with a paper plane.
  WFWorkflowIcon: { WFWorkflowIconStartColor: 4292093695, WFWorkflowIconGlyphNumber: 59836 },
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
          ActionIndex: TOKEN_ACTION,
          Category: 'Parameter',
          ParameterKey: 'WFTextActionText',
          DefaultValue: '',
          Text: 'Paste your Pushbullet access token. Create one at pushbullet.com › Settings › Account › Create Access Token. It stays in this shortcut on your devices.',
        },
        {
          ActionIndex: DEVICE_ACTION,
          Category: 'Parameter',
          ParameterKey: 'WFTextActionText',
          DefaultValue: ASK,
          Text: `Always push to one device or friend? Type its name exactly as Pushbullet shows it (or "All devices"). Leave "${ASK}" to pick from a list, with your last choice first.`,
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
  // SHORTCUT_XML=path keeps a readable copy for debugging.
  if (process.env.SHORTCUT_XML) execFileSync('plutil', ['-convert', 'xml1', '-o', process.env.SHORTCUT_XML, xml]);
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
