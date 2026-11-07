/* Polyfork · a character that walks, in three lines.
 *
 * Every humanoid here ships the same Mixamo-named skeleton and no animation,
 * and the store has always had free baked clips for it (the ones every character
 * page plays). They were reachable only from our own pages: the file had no CORS
 * header, the detail endpoint sent people to mixamo.com (an Adobe login, which
 * an agent cannot do), and the one agent we watched build a game with a farmer
 * concluded "no clips, so the walk is driven by hand" and swung the legs with
 * sines. This is those clips, from any origin, on any of our characters.
 *
 *   import { animate } from 'https://polyfork.dev/cdn/clips.mjs';
 *
 *   const anim = await animate(farmer);        // createAsset() output, or gltf.scene of the GLB
 *   anim.play('Walk');                         // cross-fades from whatever was playing
 *   // in your loop:
 *   anim.update(delta);
 *
 * For a character you steer, skip play() and say how fast it is moving:
 *
 *   anim.locomotion(speedInMetresPerSecond);   // Idle, Walk or Run, feet paced to the speed
 *
 * Clips: Idle, Walk, Run by default; ask for more with { clips: [...] }. The
 * full list is CLIP_NAMES below (also GET /cdn/anim-index.json).
 *
 * They play ON THE SPOT by default ({ inPlace: true }): a game moves its own
 * character, and a clip that also travels walks it out from under the camera.
 * Bone LENGTHS differ between characters (a child, a giant) and these are
 * rotation tracks plus a hips height scaled to the character's own, so one clip
 * fits every body with no retarget.
 */
import * as THREE from '../vendor/three.module.min.js';

export const CLIP_NAMES = ['Idle', 'Walk', 'Run', 'Agree', 'Head shake', 'Laughing', 'Drinking', 'Drunk idle',
  'Punch', 'Kick', 'Hard landing', 'Swimming', 'Treading water', 'Thriller', 'Swing', 'Twist', 'Hip hop',
  // Quaternius UAL (CC0). The seated ones move the hips back onto the seat: play
  // them with { inPlace: false }, or the character sits on the air in front of it.
  'Sitting', 'Sitting talking', 'Sit down', 'Stand up', 'Driving', 'Phone call', 'Talking', 'Arms folded',
  'Leaning on rail', 'Calling from rail', 'Interact', 'Pick up', 'Fixing', 'Crouch', 'Eating', 'Opening',
  'Holding torch', 'Holding lantern', 'Harvesting', 'Planting', 'Watering', 'Chopping wood', 'Walk formal',
  'Walk carrying', 'Jog', 'Pushing', 'Dance'];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const HERE = new URL('.', import.meta.url).href;
const fetched = new Map();      // url -> promise, so ten characters fetch Walk once
/* WHERE THE CLIPS LIVE: on our CDN, and only there. This file travels (it ships in
 * every kit zip) but the clips do not: they are baked from Mixamo animation, which
 * is ours to play and not ours to hand out as files inside a download we sell. So
 * a copy of this module running from someone's game folder asks the CDN, and does
 * NOT look beside itself first: that probe is a 404 in the game's own console, and
 * a 404 fails any honest checker. Only a copy served by us looks next door. */
const CDN = 'https://polyfork.dev/cdn/';
const HOME = /^https:\/\/polyfork\.dev\//.test(HERE) ? HERE : CDN;
const getClip = (base, name) => {
  const url = `${base}anim-${slug(name)}.json`;
  if (!fetched.has(url)) {
    fetched.set(url, fetch(url).then((r) => {
      if (!r.ok) throw new Error(`clips.mjs: no clip "${name}" (HTTP ${r.status}). The names are: ${CLIP_NAMES.join(', ')}`);
      return r.json();
    }));
  }
  return fetched.get(url);
};

/* The reference hip height the clips were baked at, in metres. */
const BAKED_HIP = 0.95;

function toClip(raw, name, bones, hips, inPlace) {
  const tracks = [];
  for (const [bone, values] of Object.entries(raw.tracks)) {
    const b = bones[bone];
    if (!b || !values.length) continue;
    // By uuid, not by name: a character can carry a group called "Head" as well
    // as the bone, and a name would bind to whichever the search met first.
    tracks.push(new THREE.QuaternionKeyframeTrack(`${b.uuid}.quaternion`, raw.times.slice(), Float32Array.from(values)));
  }
  /* The REST hips. A composition that posed a figure as a still (a worker sat on a
   * chair) moved the hips bone to do it and wrote where they were in
   * userData.restHips; the clip's offsets are from the rest, so a seated clip would
   * otherwise lower him twice. */
  let rest = hips.position.clone();
  for (let o = hips.parent; o; o = o.parent) {
    const r = o.userData?.restHips;
    if (Array.isArray(r) && r.length === 3) { rest = new THREE.Vector3(...r); break; }
  }
  const ratio = (rest.y || BAKED_HIP) / BAKED_HIP;
  const pos = new Float32Array(raw.hips.length);
  for (let i = 0; i < raw.hips.length; i += 3) {
    pos[i] = rest.x + (inPlace ? 0 : raw.hips[i] * ratio);
    pos[i + 1] = rest.y + raw.hips[i + 1] * ratio;
    pos[i + 2] = rest.z + (inPlace ? 0 : raw.hips[i + 2] * ratio);
  }
  tracks.push(new THREE.VectorKeyframeTrack(`${hips.uuid}.position`, raw.times.slice(), pos));
  return new THREE.AnimationClip(name, -1, tracks);
}

export async function animate(character, { clips = ['Idle', 'Walk', 'Run'], inPlace = true, fade = 0.2, base = HOME } = {}) {
  const bones = {};
  character.traverse((o) => { if (o.isBone && !bones[o.name]) bones[o.name] = o; });
  const hips = bones.Hips;
  // Hips alone is not enough: our animals have Hips, Spine, Neck and Head as well,
  // and a person's walk played on a sheep folds it in half without any error.
  if (!['Hips', 'Spine2', 'LeftForeArm', 'RightUpLeg'].every((n) => bones[n])) {
    throw new Error('clips.mjs: this is not one of our humanoids (it lacks the Mixamo bones Hips, Spine2, '
      + 'LeftForeArm, RightUpLeg), so these clips do not fit it. Animals and machines move differently: '
      + 'see walk.mjs, or the `animation` field of get_asset.');
  }
  if (!base.endsWith('/')) base += '/';
  const raws = await Promise.all(clips.map((n) => getClip(base, n)));
  const mixer = new THREE.AnimationMixer(character);
  const actions = {};
  clips.forEach((n, i) => { actions[n] = mixer.clipAction(toClip(raws[i], n, bones, hips, inPlace)); });

  let current = null;
  const play = (name, { fade: f = fade, loop = true, timeScale = 1 } = {}) => {
    const next = actions[name];
    if (!next) throw new Error(`clips.mjs: "${name}" was not loaded. Loaded: ${Object.keys(actions).join(', ')}. Pass { clips: [...] } to animate().`);
    next.timeScale = timeScale;
    if (next === current) return next;
    next.reset();
    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loop;
    next.play();
    if (current) current.crossFadeTo(next, f, false);
    current = next;
    return next;
  };

  /* The speeds the Walk and Run cycles were captured at, for a body of the baked
   * height: pacing the clip to the real speed is what stops feet from skating. */
  const scale = (hips.position.y || BAKED_HIP) / BAKED_HIP;
  const locomotion = (speed) => {
    const s = Math.abs(speed) / scale;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    if (s < 0.15 || !actions.Walk) return play(actions.Idle ? 'Idle' : clips[0]);
    if (s < 2.8 || !actions.Run) return play('Walk', { timeScale: clamp(s / 1.45, 0.55, 1.9) });
    return play('Run', { timeScale: clamp(s / 3.9, 0.7, 1.6) });
  };

  if (actions.Idle) play('Idle', { fade: 0 });
  return { mixer, actions, play, locomotion, update: (dt) => mixer.update(dt), names: Object.keys(actions) };
}

export default animate;
