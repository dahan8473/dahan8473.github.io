# Media drop folder

Drop files here, then say the word and they get wired in.

## Portrait
- `media/portrait.jpg` (or .webp). Square crop, at least 480x480.
- Shows top-left of the homepage header, grayscale until hover.

## Guitar recordings
- `media/guitar/<name>.mp3`. 128 to 192 kbps is plenty.
- For each track, note the display title (e.g. "Recuerdos de la Alhambra").
- They render as minimal play rows on the Guitar entry. Nothing shows until
  tracks are listed in `site.js`.

## Hover photos
- `media/hover/<entry>.jpg`, e.g. `genesis.jpg`, `muaythai.jpg`, `guitar.jpg`,
  `tethos.jpg`, `wfn.jpg`.
- Landscape, at least 640px wide, under ~300KB each.
- Hovering that entry on desktop floats the photo near the cursor. Wired by
  adding `data-photo` to the entry, nothing shows until then.
