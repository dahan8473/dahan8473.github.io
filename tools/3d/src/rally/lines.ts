// Everything the head says (from play/badminton.js). David's texting voice:
// lowercase, short, humble, no em dashes.
export const L = {
  hello: ['ok rally with me', 'first to 7. go easy on me', "ok let's hit"],
  picked: (r: string) => [`ok the ${r}. good pick`, `the ${r}, nice. first to 7`, `you took the ${r}? ok let's hit`],
  yourServe: ['your serve', 'you serve first', 'serve whenever'],
  myServe: ['my serve', 'ok my serve', 'serving'],
  wait: ["whenever you're ready", "serve's yours", 'take your time'],
  smashYou: ['ok that smash 😭', 'too fast', "i didn't even see that", 'that had some wrist on it'],
  dropYou: ['ok ok nice drop shot', 'the drop 😭', 'i was way too far back', 'sneaky'],
  netYou: ['net shot!! clean', 'so tight at the net', "can't get that one"],
  clearYou: ['that went so deep', 'ok nice length', 'pushed me all the way back'],
  driveYou: ['that drive was flat', 'too quick for me', 'ok flat and fast'],
  tooGood: ['nope, too good', "couldn't get there", 'my legs said no'],
  headOut: ['that was out. i think. probably', "ok that's long", 'out. my bad', 'too much wrist lol'],
  headWide: ['wide. my bad', 'that one drifted', 'ok that was out'],
  headNet: ['into the net 😭', 'net. classic me', 'the tape got me', 'ugh net'],
  badLeave: ['wait that was in??', 'i thought that was going out 😭', 'bad leave, my fault'],
  goodLeave: ['out!', 'watched that one go out', 'long, my point i think'],
  headSmash: ['my smash is all wrist lol', 'sorry that one was fast', 'ok i had to'],
  headDrop: ['drop shot 👀', 'got you at the net', 'soft hands. kind of'],
  headWin: ['my point', 'lucky', 'phew', "ok i'll take it"],
  youOut: ['long!', 'just out i think', 'out. close though'],
  youWide: ['wide', 'just wide i think', 'out on the side'],
  youNet: ['net', 'tape 😭', 'unlucky'],
  youShort: ["short serve, didn't reach the line", 'serve was short'],
  youEarly: ['a bit early', 'wait for it', 'too early lol'],
  youLate: ['swing a bit earlier', 'almost had it', 'so close'],
  youLeft: ['you just watched it 😭', 'that was in!', 'you gotta swing'],
  long: ['this rally 😭', 'my legs', 'ok this is a real rally', "i'm so tired lol"],
  newBest: ['new best rally!!', "that's our longest one"],
  matchWin: ['good game. you got me', "ok you're better than me lol", "gg. don't tell my club"],
  matchLose: ['gg!! run it back?', 'i got lucky. again?', 'good game though. one more?'],
  paused: ['water break', 'take your time', 'tying my shoes']
};

const lastPicked = new WeakMap<readonly string[], number>();
export function pick(arr: readonly string[]) {
  let i = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && i === lastPicked.get(arr)) i = (i + 1) % arr.length;
  lastPicked.set(arr, i);
  return arr[i];
}

/** Short, lowercase racket names the head would use. */
export function nickname(name: string) {
  const n = name.toLowerCase();
  if (n.includes('z-force') || n.includes('zforce')) return 'z-force';
  if (n.includes('duora')) return 'duora';
  if (n.includes('100zz')) return '100zz';
  if (n.includes('arcsaber')) return 'arcsaber';
  return n.replace(/^yonex\s+/, '');
}
