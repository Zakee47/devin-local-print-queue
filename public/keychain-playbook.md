# Playbook: 3D Printing Competition – Build Your Keychain (STL + 3MF)

## Overview
This playbook takes a competitor's own keychain idea to print-ready files that follow the competition size rules. The idea can be a sketch, a description, text, an SVG logo or an existing mesh. Devin models it with a deterministic Blender Python script run headless (`blender --background --python ...`), so no GUI or sculpting is involved. The output is a single-colour, watertight STL and a matching single-colour 3MF project, an editable `.blend`, preview renders and an **entry check report** that proves the design fits its size class. Every dimension is a named constant in code, so every entry is measured the same way and can be rebuilt exactly.

The design is up to the competitor, but the competition has limited printer time. Each entry therefore has to stay close in size, material and print time to the reference keychains that printed successfully, so everyone gets at least one print. The size class, the material and time budget, the ring attachment and the printability minimums are fixed and are not negotiable.

## What's Needed From User
- **The keychain idea**, in any of these forms:
  - A description ("a rocket with my initials on the fin").
  - A sketch or image.
  - Text or a name.
  - An SVG logo.
  - An STL/OBJ mesh they are allowed to use.
- **Size class**: `K40`, `F50` or `F27` (see Specifications). If they don't choose, recommend K40 for a 3D character or object and F50 for a logo, text or other flat design.
- Nothing about printers or filament. Entries are **single colour only**. Devin only designs the model and never runs a slicer. The organisers check print time in their own slicer.
- Optional: text or a second design for the back of a flat keychain.
- Optional: a Git repo to commit to. Without one, deliver the files as chat attachments.

## Procedure
1. **Set up the toolchain.** Download Blender 4.2 LTS from `https://download.blender.org/release/Blender4.2/blender-4.2.9-linux-x64.tar.xz`, extract it to `~/blender` and check it with `~/blender/blender --version`. Install Shapely into Blender's Python with `~/blender/4.2/python/bin/python3.11 -m pip install shapely`. Create the layout `assets/source/` (competitor originals, never edited in place), `scripts/` and `out/previews/`.
2. **Confirm the brief.** Restate the idea and size class in two or three lines. Agree on the look before modelling: a quick sketch-level description, or for images a traced outline preview. Rework after a full build costs much more.
3. **Turn the idea into source geometry.** Pick the route that fits the input:
   - **Mesh supplied.** Import it (`bpy.ops.wm.stl_import` / `wm.obj_import`) and use it unchanged. Never replace it with an approximation.
   - **SVG supplied.** Import it with `bpy.ops.import_curve.svg`. Split each spline into its own object before filling, because a self-overlapping path otherwise cancels itself under even-odd fill.
   - **Text.** Use a Blender font object (`bpy.data.curves.new(type="FONT")`, a bold font such as the bundled Bfont or a user-supplied `.ttf`), then convert it to mesh.
   - **Description or sketch.** Build it in code from primitives (`bpy.ops.mesh.primitive_*`) combined with booleans. For a flat design from an image, write the outline as an SVG path (or trace the image's silhouette into polygons with Shapely), render it, and show it to the competitor before continuing.
4. **Write the build script** `scripts/build_keychain.py`.
   - Put every size-class constant from the Specifications at the top, in final-print millimetres (1 Blender unit = 1 mm). Add a `--class K40|F50|F27` flag that selects a config dictionary.
   - Build only with the Boolean modifier set to `solver = "EXACT"`, applied immediately. Never use `join` on overlapping solids: the result self-intersects and breaks every later boolean. After each boolean, look the object up again by name.
   - Clean with `bmesh`: `remove_doubles` (~0.002 mm), `dissolve_degenerate`, `recalc_face_normals`.
   - Do all 2D offsets (plate halos, clearances, stroke measurements) with Shapely, and triangulate back to a flat mesh with `mathutils.geometry.tessellate_polygon`.
5. **Fit the design to its size class.** Follow the rules for the chosen class exactly. For K40: scale uniformly, fuse the bridge loop, then rescale so the finished part is exactly 40.0 mm tall. For F50/F27: scale the design to the largest size that fits the envelope, then add the plate, lug and hole from that class's config. For every class, check the solid volume against the class budget straight away. If it's over, slim the design now rather than at the entry check. Take every F27 value from its own config: F27 is not F50 × 0.5.
6. **Check after every stage.** Use `bmesh` to count boundary edges (≠2 linked faces) and non-manifold edges (>2 linked faces), and read the signed volume and bounding box. Raise an error if the edge count is above zero or the volume is ≤ 0. Write every class minimum as a `raise` too, so an out-of-spec design fails the build instead of exporting. If a union of merely touching faces fails, overlap the parts by 0.5 to 1 mm.
7. **Enforce printability and log every decision.** Measure each detail at final size with Shapely: erode by half the minimum stroke and see what vanishes, or take distances between edges. Keep strokes of at least 1.0 mm with gaps of at least 0.8 mm. Drop anything under 0.8 mm. For 0.8 to 1.0 mm, decide case by case and state the decision. When a feature the competitor cares about is too thin, ask them whether to thicken it, enlarge it within the class, or drop it. Log each dropped feature and its measured width.
8. **Export.** Write:
   - `out/keychain.3mf`: the main entry file, written by `scripts/build_keychain.py` in the single-colour 3MF format below. It holds the same shell as the STL and is centred on the bed.
   - `out/keychain.stl` (`bpy.ops.wm.stl_export`, selected object only, `global_scale=1.0`): the fallback for other slicers.
   - `out/keychain.blend` (`wm.save_as_mainfile`).

   Both print files hold one single-colour shell. Never split it into parts or assign a second filament.
9. **Render previews and iterate with the competitor.** Use `scripts/render_keychain.py`, which opens the `.blend` and renders EEVEE clay views: front, three-quarter, back, and a close-up of the loop or hole.
   - First check every PNG yourself for buried or clipped features, loops that aren't attached, and details that don't read. Fix those before showing anything.
   - Then send the previews to the competitor with the current bounding box and volume, and **ask for feedback**: what to change, and whether it's ready for the entry check.
   - Apply each round of feedback by changing constants or geometry in the build script, never by hand edits. Rerun steps 5–9.
   - Repeat until the competitor approves. Rule violations are not open to feedback: if a request would break a class limit, say which rule it breaks and offer an alternative.
10. **Run the entry check.** Write `scripts/check_entry.py` and run it on the *exported* files in a fresh headless Blender. It must confirm:
    - 0 boundary edges and 0 non-manifold edges.
    - Volume > 0 and min Z = 0.000.
    - The bounding box within the class envelope.
    - The attachment dimensions are at or above the class minimums. Measure them by ray-casting the mesh.
    - Solid volume is within the class budget. The volume cap is what keeps print time down, since Devin does not slice.
    - The 3MF matches the STL. Parse it back with `zipfile` and check: exactly one mesh object, extruder 1, and triangle count, volume (within 0.01 mm³) and bounding box (after removing the bed translation) equal to the STL's. It contains no `Slic3r_PE*.config`.

    Write the results to `out/entry-check.md` as a table of each rule with its measured value and PASS/FAIL.
11. **Deliver.** Write a README containing: the size class; the measured bounding box; the build commands; the dropped-detail log; the slicer settings (see Advice); and the source/licence notes for any supplied artwork. Commit and open a PR if a repo was given. Always attach the 3MF, the STL, the key previews and `entry-check.md` in chat, and state the class, final bounding box and volume. Say that the organisers will confirm the print time when they slice the entry. End by asking whether the competitor wants more changes. If they do, go back to step 9 and rerun the entry check before delivering again.

## Specifications

### Size classes (all values in final-print mm; tolerance ±0.1 unless stated)
| Rule | **K40** – 3D keychain | **F50** – flat keychain | **F27** – mini flat keychain |
|---|---|---|---|
| Height, including attachment | **exactly 40.0** | **≤ 50.0** | **≤ 27.5** |
| Width × depth (footprint) | each ≤ 45.0 | width ≤ 40.0 | width ≤ 20.0 |
| Thickness | Not applicable (3D) | **exactly 4.5** total | **exactly 2.8** total |
| **Max solid volume (material budget)** | **≤ 10,000 mm³** (~12.4 g PLA) | **≤ 5,000 mm³** (~6.2 g) | **≤ 900 mm³** (~1.1 g) |
| **Print-time target** (checked by the organisers) | **≤ 25 min** | **≤ 10 min** | **≤ 4 min** |
| Attachment | Fused bridge loop over the top | Round lug + through-hole above the design | Round lug + through-hole above the design |
| Ring opening | Passage ≥ 2.8 | Hole Ø **4.0** | Hole Ø **3.0** |
| Attachment strength | Bar thickness ≥ 3.2; each leg buried ≥ 3.5 | Wall around hole ≥ 2.0; lug radius 4.0; neck base/top 7.0/5.0; junction ≥ 6.0 | Wall around hole ≥ 1.75; lug radius 3.25; neck base/top 4.5/3.5; junction ≥ 3.0 |
| Base plate / raised design | Not applicable | Plate 2.5 + design 2.0 proud (1.0 buried) | Plate 1.6 + design 1.2 proud (0.6 buried) |
| Plate halo around design / min web | Not applicable | 1.8 / ≥ 1.5 | 1.2 / ≥ 1.2 |
| Hole to raised design clearance | Not applicable | ≥ 2.2 | ≥ 1.2 |
| Reference build that printed successfully (bounding box / volume) | 23.1 × 43.4 × 40.0 / 9,183 mm³ | 38.5 × 50.0 × 4.5 / 4,519 mm³ | 19.9 × 27.2 × 2.8 / 797 mm³ |
| Reference slicer estimate (time / PLA) | 22m 46s / 5.5 g with tree supports (19m 50s / 4.8 g without) | 9m 13s / 3.7 g | 3m 41s / 0.9 g |

The budgets are the reference keychains plus about 10%. Volume is the signed volume of the watertight shell; Devin measures it in the entry check. The reference times are Bambu Studio estimates on a Bambu Lab P2S (0.4 mm nozzle, `0.20mm Standard @BBL P2S`, Bambu PLA Basic), including any supports. An entry that stays inside the size class and volume budget lands close to its reference time. The organisers confirm the final time in their own slicer. A design that is over budget must be slimmed: make it smaller within the class, hollow out heavy regions, or thin non-structural parts. Never raise the budget.

### K40 rules
- The loop is the upper half of a torus plus two vertical legs, fused onto the top of the object. It sits in the front-back vertical plane (Y-Z), so the ring pulls along the layer lines.
- The torus is clipped 2.0 mm below its springing line, leaving a stub for the legs to overlap.
- Build order: scale the object → union the legs → union the arch → rescale the whole part to 40.0 mm tall → check.
- Keep the top of the object intact. Never cut a groove or saddle into it to seat the loop.
- Rejected attachments, which are not allowed:
  - A hole through the body. The tunnel is 16 to 23 mm long, which needs a split ring of about 28 to 55 mm.
  - A hole through a thin feature such as a tail, ear or fin. These leave walls under 2 mm and snap.
- Loop sizing that meets the minimums: tube diameter ~3.2 to 3.4 and loop major radius ~4.5 to 4.7 at final size.

### F50 / F27 rules
- Orientation is +Y up. The lug and hole sit above the design's top point and never cover or cut it.
- The plate is the union of every design piece's outline, offset by the halo, with internal voids filled. Separate pieces therefore never hang on point contacts.
- Hole, halo, thickness and web have fixed minimums, so never shrink F50 to make F27. A 0.9 mm halo produced a 0.84 mm web, which is too weak.
- **Optional back design.** It goes on the flat back, mirrored in X, and is **recessed** 0.6 deep: never make it a raised feature. It must leave a floor of at least 1.5, strokes of at least 1.0, gaps of at least 0.8 and at least 1.2 clear of the edge. If the artwork can't meet these at a size that fits, drop it and log why.

### Single-colour 3MF format
Write it by hand with Python's `zipfile`, because Blender has no 3MF exporter. The Bambu metadata and project settings make it open in Bambu Studio on the competition profile without warnings; other slicers read the mesh. Take the vertices and triangles from the final evaluated mesh, in millimetres. The zip contains:
- `[Content_Types].xml` and `_rels/.rels` (pointing to `/3D/3dmodel.model`).
- `3D/3dmodel.model`:
  - `unit="millimeter"`.
  - The metadata lines `<metadata name="Application">BambuStudio-02.08.02.60</metadata>` and `<metadata name="BambuStudio:3mfVersion">1</metadata>`.
  - Object 1 is the mesh. Object 2 is a parent with a single `<component objectid="1">` and an identity transform.
  - A `<build><item objectid="2">` whose transform translates the part to the bed centre (128, 128 on a 256 mm bed) with Z unchanged.
- `Metadata/model_settings.config`:
  - `<object id="2">` with `name` and `extruder` = 1.
  - One `<part id="1" subtype="normal_part">` with the same `name`, an identity `matrix` and `extruder` = 1.
- `Metadata/project_settings.config`: JSON naming the **stock** competition presets:
  - `"printer_model": "Bambu Lab P2S"`
  - `"printer_settings_id": "Bambu Lab P2S 0.4 nozzle"`
  - `"print_settings_id": "0.20mm Standard @BBL P2S"`
  - `"nozzle_diameter": ["0.4"]`
  - `"filament_settings_id": ["Bambu PLA Basic @BBL P2S"]`
  - `"filament_type": ["PLA"]`
  - `"filament_colour": ["#FFFFFF"]` (colour is irrelevant; the printer's loaded filament is used)
- Never include `Slic3r_PE*.config`. With it present, Bambu Studio warns "invalid config, load geometry data only".

### Deliverables
- `out/keychain.3mf`: the main entry file, a single-colour project on the competition profile.
- `out/keychain.stl`: the same watertight shell at final size, as a fallback.
- `out/keychain.blend`.
- `out/previews/*.png`.
- `out/entry-check.md`: every rule PASS.
- `scripts/` containing the build, render and check scripts, which reproduce the files exactly.
- `README.md` as described in step 11.

## Advice and Pointers
- **Slicer settings for the README and the competitor:** 0.2 mm layers, 0.2 mm first layer, 0.4 mm nozzle.
  - Set elephant-foot compensation to **0** if any detail is on the bottom face, because it closes first-layer detail.
  - Print F50/F27 flat, design up, with no supports.
  - Print K40 upright. The half-torus arch prints without supports; use tree supports on the build plate only if the object itself overhangs.
- **Why headless Blender.** Every dimension lives in code, a rebuild is identical, and edits like "make the fin thicker" or "swap to F27" become one-constant changes rather than redos. It also makes the entry check objective.
- **What makes a good competition keychain.** Use a strong, simple silhouette. Keep the loop at the top and centred over the object's centre of mass so it hangs straight. Put detail in raised or recessed areas that are at least 1 mm wide, not in hairline texture. The small classes punish fine detail.
- **Diagnose with measurements.** When a render looks wrong, write a small probe script before changing geometry: ray-casting, per-feature thickness, or comparing the silhouette with the source SVG.
- **Tilted faces.** Derive axes on a tilted face from the object's rotation matrix. A hand-written normal is easy to get subtly non-perpendicular, which skews and buries embossing.
- **Single colour only.** If a competitor asks for two colours, explain that the competition prints every entry in one colour to keep print time fair. Suggest getting contrast from shape instead: raised or recessed areas at least 1 mm wide.
- **Getting good feedback.** Ask specific questions when you share previews, such as "Is the loop in the right place?", "Should the text be bigger?" or "Anything missing from your idea?". Keep each round to one set of changes so the competitor can see what moved.

## Forbidden Actions
- Do not change a size-class limit or minimum, or invent a new class. If the design can't meet a rule, report the measured value and offer design changes.
- Do not replace a competitor's supplied mesh, SVG or artwork with an approximation, and do not edit the originals in `assets/source/`.
- Do not use a through-body or thin-feature keyring hole on K40, or cut a groove into the object to seat the loop.
- Do not produce two-colour or multi-material output (multi-part or two-filament 3MFs, per-colour STLs or painted parts). Entries are one single-colour shell, delivered as a 3MF plus an STL.
- Do not deliver a mesh with boundary or non-manifold edges, or an entry with any FAIL in `entry-check.md`.
- Do not deliver the final entry without asking the competitor for feedback on the previews first.
- Do not claim the files were rebuilt or checked without running the build and check scripts in the current session.
