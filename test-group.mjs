import assert from "node:assert/strict";
import { splitTitle, workKey, groupTracks } from "./group.js";

assert.deepEqual(splitTitle("Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio"),
  { work: "Symphony No. 5 in C Minor, Op. 67", movement: "I. Allegro con brio" });
assert.deepEqual(splitTitle("Piano Sonata No. 14 - I. Adagio"),
  { work: "Piano Sonata No. 14", movement: "I. Adagio" });
assert.equal(splitTitle("Gymnopédie No. 1").movement, "");
assert.equal(workKey("Symphony No. 5 in C Minor, Op. 67"), workKey("Symphony No.5 in C minor, op.67"));
assert.notEqual(workKey("Symphony No. 5, Op. 67"), workKey("Symphony No. 5, Op. 100"));

const al = (id, name) => ({ id, name, images: [], release_date: "1963-01-01" });
const tr = (id, name, album, n) => ({ id, name, album, track_number: n, artists: [{ name: "Karajan" }], uri: "spotify:track:" + id });
const A = al("a", "Beethoven: Symphonies"), B = al("b", "Beethoven 5");
const g = groupTracks([
  tr("1", "Symphony No. 5 in C Minor, Op. 67: II. Andante", A, 2),
  tr("2", "Symphony No. 5 in C Minor, Op. 67: I. Allegro", A, 1),
  tr("3", "Symphony No. 5 in C Minor, Op. 67: I. Allegro", B, 1),
  tr("4", "Symphony No. 6 in F Major, Op. 68: I. Allegro", A, 5),
]);
assert.equal(g.length, 2);
assert.equal(g[0].recordings.length, 2);
assert.equal(g[0].recordings[0].movements[0].name, "I. Allegro");
console.log("ok");
