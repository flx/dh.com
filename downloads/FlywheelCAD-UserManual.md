# FlywheelCAD User Manual

## 1. What FlywheelCAD Is

FlywheelCAD is a Python-first, constraint-driven CAD application.

- You draw and edit sketches interactively in the UI.
- You can also script everything in `.py` files (which are plain Python files).
- Geometry is solved by constraints and dimensions.
- Closed sketch areas can be turned into 3D bodies (extrude/revolve), then combined with boolean operations.

The workflow is intentionally hybrid: UI for fast interaction, Python for reproducibility and reuse.

## 2. Core Concepts

- `Design`: The full model (sketches, constraints, variables, 3D bodies).
- `Sketch plane`: A 2D workspace on a 3D plane. Standard planes are `xy`, `yz`, `zx`.
- `Sketch elements`: Points, lines, circles, arcs, ellipses, splines.
- `Constraints`: Geometric relationships (parallel, perpendicular, tangent, coincident, etc.).
- `Dimensions`: Numeric/variable-driven constraints (distance, length, radius, angle, point-line distance, parallel distance).
- `Variables`: Shared scalar values used by dimensions.
- `Areas`: Closed regions detected from sketch geometry. Areas are used for extrude/revolve.

## 3. UI Overview

The window has three main parts:

- Top toolbar: sketch tools, sketch switching, constraints/dimensions, variables, body operations.
- Main canvas: either 3D scene view or 2D sketch editor.
- Right panel: script editor and Execute button.

### 3.1 3D Mode

- Orbit/pan/zoom the model.
- Select bodies and topology points.
- Create custom sketch planes from selected 3D points.
- Run boolean operations on selected bodies.

### 3.2 Sketch Mode

In sketch mode, the top toolbar gives you:

- Tool modes: select, line, circle, ellipse, rectangle, spline, arc, trim, pan, zoom.
- Construction toggle: construction geometry is dashed and excluded from area detection.
- Sketch selector: switch active sketch plane.
- Constraint menu: applies geometric constraints to selected entities.
- Dimension menu: applies dimensional constraints and variable bindings.
- Variables panel: manage dimension variables and numeric display precision.
- Extrude/Revolve menu: create bodies from selected closed areas.

Keyboard shortcuts in sketch mode:

- `Esc`: cancel current draw operation (or return to 3D when idle).
- `L`, `C`, `E`, `R`, `A`, `T`: line/circle/ellipse/rectangle/arc/trim.
- `X`: toggle construction mode.
- `Enter`: finish spline while drawing.

### 3.3 Selection Behavior

- Click entities to select.
- Drag selection window left-to-right: containment selection.
- Drag selection window right-to-left: crossing selection.
- Area selection: click inside a closed region in select mode. Selected areas are tinted.

If an area does not select, verify:

- The loop is actually closed.
- Boundary elements are not construction geometry.
- Intersections/trim states are valid (especially after recent edits).

### 3.4 Busy State

When solving or replaying scripts, the UI shows a computing overlay (`Computing...` / `Executing Script...`) instead of beachball-style blocking.

## 4. Script Model and File Types

## 4.1 `.py` Files

A `.py` file is plain Python that imports `flywheelcad`:

```python
from flywheelcad import *
cad = FlywheelCAD()
```

When executed, this Python script emits intermediate CAD commands to stdout; the app parses and executes those commands.

## 4.2 Local Python Modules

You can place helper `.py` files next to your `.py` file and import them directly.

- Working directory for execution is the document folder.
- That folder is also put on `PYTHONPATH`.

So this works:

```python
from my_helpers import build_feature
```

## 4.2.1 Component Libraries

Reusable catalog parts (motors, bearings, …) come from **component libraries**:
folders of ordinary Python component modules. The **standard library** ships
inside the app; add your own libraries as folders under
`~/Documents/FlywheelCAD/Libraries/` (one folder per library — dropping in a
downloaded or git-cloned folder is the whole install).

Inserting a part is **copy-on-use**: the app copies the module into your
document folder under `lib/<library>/`, so the document stays self-contained
and a later library update never silently changes your design. The vendored
file carries a provenance header and appears as a read-only library tab in the
script panel — don't edit it; to customize a part, copy the file up into your
document folder as a normal user module instead.

- **Component ▸ Insert from Library…** browses the installed libraries, shows
  each factory's parameters (blank keeps the factory default), copies the
  files, and appends the script lines:

  ```python
  from lib.standard.steppers import stepper
  part1 = stepper(cad, size=17)
  inst1 = cad.instance(part1)
  ```

- **Component ▸ Update from Library** refreshes vendored files whose source
  library has a newer version. Locally edited copies and files from
  uninstalled libraries are reported in the console and never overwritten.

Library parts export **named anchors** (the stepper: `mount_face`,
`shaft_tip`, `shaft_base`, `bolt_0..3`) — mate to them like to any instance
anchor, e.g. `cad.mate_coincident("bracket_1", "hole_0", "inst1.bolt_0")`.

## 4.2.2 Project Bundles (`.fwcad`)

A document can be saved in either of two formats:

- **Flat `.py`** — a single script file. Its helper modules and vendored
  `lib/` folder live next to it in the enclosing folder.
- **`.fwcad` project bundle** — a folder (shown as one document icon in
  Finder) that packages the script as `main.py` together with every file it
  imports. A bundle is self-contained, so it moves, copies, and shares as a
  single item without leaving its dependencies behind.

New documents start as bundles. Everything else works the same in both formats
— the bundle's `main.py` *is* the script you edit, and its folder is the
working directory that imports resolve against.

File-menu commands for bundles (all operate on the focused document):

- **File ▸ Convert to Project Bundle…** — package a flat `.py` (and the whole
  dependency closure `ImportScanner` finds) into a new `.fwcad`. The original
  flat file is left untouched.
- **File ▸ Export as Flat Script…** — the reverse: write a bundle back out as a
  flat `.py` plus its `lib/` folder, for sharing as loose files.
- **File ▸ Show Project Contents** — reveal the document's files in Finder
  (the bundle's insides, or a flat file's folder). Because a bundle hides its
  contents behind one icon, use this rather than hand-navigating in Finder.
- **File ▸ Open Script in External Editor** — open the script (`main.py` inside
  a bundle) in your default `.py` editor. The document watches the file, so
  external edits round-trip back into the app.

## 4.2.3 Adding Files and Standalone Components

Two File/Component-menu commands bring a loose `.py` that isn't in a library
into the current project by **copying** it in (never referencing it in place),
so the project stays self-contained:

- **File ▸ Add File to Project…** — copy a helper module into the project so
  the script can `import` it by name. The file lands at the project root under
  a sanitized module name (a non-identifier filename like `my-helper.py` is
  renamed to `my_helper.py`); a name clash prompts before replacing. Adding a
  file does **not** edit the script — you write the `import` yourself, since a
  helper may be imported by another module rather than `main.py`.
- **Component ▸ Insert Component from File…** — copy a standalone component
  `.py` and place one instance. A **factory module** (functions taking `cad`
  first) opens a parameter sheet, then appends
  `from <mod> import <factory>` / `part = <factory>(cad, …)` /
  `inst = cad.instance(part)`. A **fixed-instance component** (a
  `with cad.component("name")` file) is placed directly with
  `import <mod>` / `cad.instance("name")`. A plain helper (neither) is declined
  with a pointer to Add File. The file's own sibling imports are copied along
  with it.

Both require a saved document (the copy needs somewhere to land). Use **Show
Project Contents** to see the copied files.

## 4.3 Plane Naming

Use suffix-free plane names:

- Standard: `xy`, `yz`, `zx`
- Custom: your own names (for example, `endface`, `fixture_a`)

Do not use `_plane` suffix in scripts.

## 5. Python API Quick Reference

All calls below are on `cad = FlywheelCAD()`.

### 5.1 Sketch Context

- `cad.with_sketch("xy")`
- `cad.with_sketch("my_custom_plane")`

Standard origin points are auto-injected: `origin_xy`, `origin_yz`, `origin_zx`.
Custom origins are available as `origin_<planeName>` once that sketch context is used.

### 5.2 Geometry Creation

- `cad.point2d(x, y)`
- `cad.line2d(p1, p2, construction=False)`
- `cad.circle2d(center, radius, construction=False)`
- `cad.arc2d(center, start, end, clockwise=False, construction=False)`
- `cad.ellipse2d(focus1, focus2, point, construction=False)`
- `cad.spline2d(points=[...], closed=False, construction=False)`
- `cad.trim(element, near=(x, y))`

`trim` returns `(element, element_1_ref)` where the second ref is valid when a split is created.

### 5.3 Geometric Constraints

- `cad.horizontal(line=l1)`
- `cad.vertical(line=l1)`
- `cad.parallel(line1=l1, line2=l2)`
- `cad.perpendicular(line1=l1, line2=l2)`
- `cad.collinear(line1=l1, line2=l2)`
- `cad.coincident(p0=p1, p1=p2)`
- `cad.pointlinecoincident(point=p1, line=l1)`
- `cad.pointoncircle(point=p1, circle=c1)`
- `cad.pointonellipse(point=p1, ellipse=e1)`
- `tp1 = cad.circletangentline(circle=c1, line=l1)`
- `cad.circletangentcircle(circle1=c1, circle2=c2)`
- `tp2 = cad.ellipsetangentline(ellipse=e1, line=l1)`
- `cad.equallines(line1=l1, line2=l2)`
- `cad.equalradius(circle1=c1, circle2=c2)`

### 5.4 Dimensions and Variables

- `d1 = cad.variable(100.0, fixed=True)` — permanently pinned constant
- `d2 = cad.variable(30.0, driving=True)` — driving dimension: pinned during solves (drives bound geometry to its value), but editable later via `cad.update({d2: {"value": 45.0}})` or the variables panel; constraints re-solve after the edit
- `d3 = cad.variable(30.0)` — free solved parameter: an ordinary solver unknown, the solver may move it toward the geometry (use this for reference/derived values, not for dimensions that should drive geometry)
- `fixed=True` and `driving=True` together is an error.
- `cad.distance(p0=p1, p1=p2, distance=d1)`
- `cad.pointlinedistance(point=p1, line=l1, distance=d1)`
- `cad.length(line=l1, length=d1)`
- `cad.radius(circle=c1, radius=d1)`
- `cad.angle(l1, l2, d1)`

Linear expressions are supported:

```python
d1 = cad.variable(80.0)
d2 = cad.variable(12.0)
cad.length(line=l1, length=d1 * 2 + d2)
```

Use explicit API calls for dimensions in Python (`cad.length`, `cad.radius`, etc.).

### 5.5 Point and Geometry Updates

- `cad.merge_points(source, target)`
- `cad.update({p1: {"x": 10.0, "y": 20.0}})`
- `cad.update({d2: {"value": 45.0}})` — set a scalar variable's value (geometry bound to a fixed/driving variable follows after the re-solve)
- `cad.ensure_convergence()`

### 5.6 3D Operations

- `cad.region(loop=[...], holes=[[...]], inside=(x, y))` — a region is identified by its directed boundary loop (the outer element cycle, with `rev(e)` or `"-name"` marking an element traversed against its intrinsic direction), optional hole loops, and an optional `inside` point to disambiguate twin regions tracing the same loop. `loop=` is required.
- `cad.extrude(plane, region_intent, distance, direction=None, quality=None, edge_radius=None)`
- `cad.revolve(plane, region_intent, axis, angle, quality=None, edge_radius=None)`
- `cad.loft(start_plane=..., start_region=..., end_plane=..., end_region=..., quality=None, edge_radius=None)`
- `cad.bool_union(body1, body2, ..., quality=None, blend=None, radius=None)`
- `cad.bool_difference(bodyA, bodyB, ..., quality=None, blend=None, radius=None)`
- `cad.bool_intersection(body1, body2, ..., quality=None, blend=None, radius=None)`
- `cad.offset(body, distance=...)`
- `cad.section(body, plane)`
- `cad.project(body, plane)`
- `cad.project_point(point, plane)`
- `cad.delete_body(body)` (or `body.delete()`) — deletes a body, cascading to any boolean/offset bodies built from it

Quality values: `"preview"`, `"standard"`, `"high"`, `"ultra"`.

#### Region Identity

The primary way to name a region is its **directed boundary loop**: the outer
boundary as an ordered cycle of elements, each traversed either along its
intrinsic direction or against it (wrap with `rev(...)`, or use a `"-name"`
string). Holes are listed as their own loops, and a single `inside=(x, y)`
material point disambiguates twin regions that trace the same loop.

```python
# Middle-left face of a circle crossed by chords: down the left arc,
# east along l10, then back up l7 and west along l4 against their
# intrinsic p1->p2 directions.
body = cad.extrude("xy", region(loop=[c1, l10, rev(l7), rev(l4)]), 5)

# Full disk (all chord seams cancel) with an inside point:
body = cad.extrude("xy", region(loop=[c1], inside=(0, 0)), 5)

# Square with a circular hole:
body = cad.extrude("xy", region(loop=[l1, l2, l3, l4], holes=[[c1]]), 5)
```

Loop matching is rotation-invariant (any starting element works) and accepts
a fully reversed loop (a hand-written clockwise cycle). Intrinsic directions:
lines run p1 → p2, circles/arcs/ellipses are counter-clockwise, splines follow
control-point order.

The `required`/`witness`/`adjacent`/`side` fields are the legacy region
identity; old scripts using them keep replaying, but the UI no longer
generates `adjacent`/`side` hints.

#### Edge Rounding

`edge_radius` rounds the sharp edges where a 2D profile meets the extrusion/revolve/loft caps. The value is the fillet radius in model units. Omit or set to `0` for sharp edges (default).

```python
body = cad.extrude("xy", region(...), 10.0, edge_radius=1.5)
rbody = cad.revolve("xy", region(...), l1, 180.0, edge_radius=2.0)
lbody = cad.loft(start_plane="xy", ..., edge_radius=1.0)
```

#### Boolean Blends

`blend` and `radius` control the seam shape where two bodies meet in a boolean operation.

- `blend="smooth"` — rounded fillet (polynomial smooth-min/max).
- `blend="chamfer"` — flat 45° bevel.
- `radius` — blend size in model units.

Omit both for the default hard boolean edges.

```python
result = cad.bool_union(body1, body2, blend="smooth", radius=2.0)
result = cad.bool_difference(body1, body2, blend="chamfer", radius=1.5)
```

#### Offset (Shell)

`offset` expands or contracts a body's surface uniformly. Positive distance expands outward, negative shrinks inward.

```python
bigger = cad.offset(body1, distance=0.5)
smaller = cad.offset(body1, distance=-1.0)
```

### 5.7 Custom Sketch Planes

- `cad.point(x, y, z, name=None)` — a fixed 3D reference point at world coordinates
- `cad.create_sketch_plane(p1, p2, p3, name=None)` — origin is `p1`; the plane normal is `(p2 - p1) × (p3 - p1)`

The three points may be body topology points (`body1.v0`), existing sketch
points, or standalone reference points created with `cad.point(...)`.

From topology points:

```python
endface = cad.create_sketch_plane(body1.v1, body1.v2, body1.v0, name="endface")
cad.with_sketch("endface")
```

From explicit coordinates — useful for laying out a series of parametric
planes (e.g. an airfoil with twist, one plane per spanwise station, then
`cad.loft(...)` between the sketched profiles):

```python
p1 = cad.point(0, 0, 0)
p2 = cad.point(100, 0, 0)
p3 = cad.point(0, 0, 20)
station1 = cad.create_sketch_plane(p1, p2, p3, name="station1")
cad.with_sketch("station1")
```

In the GUI, **Sketch ▸ New Sketch from Coordinates…** opens a dialog with a
sketch name and three X/Y/Z rows (origin + two points). It creates the three
points and the plane, logging them exactly as above. **Sketch ▸ New Sketch
from 3 Selected Points** does the same from three points selected in the 3D
view.

## 6. Working Examples

## 6.1 Basic Constrained Plate With Hole

```python
from flywheelcad import *
cad = FlywheelCAD()

cad.with_sketch("xy")
p1 = cad.point2d(-120, -60)
p2 = cad.point2d(120, -60)
p3 = cad.point2d(120, 60)
p4 = cad.point2d(-120, 60)

l1 = cad.line2d(p1, p2)
l2 = cad.line2d(p2, p3)
l3 = cad.line2d(p3, p4)
l4 = cad.line2d(p4, p1)

cad.horizontal(line=l1)
cad.horizontal(line=l3)
cad.vertical(line=l2)
cad.vertical(line=l4)

w = cad.variable(240.0, fixed=True)
cad.length(line=l1, length=w)

c1 = cad.circle2d(origin_xy, 20)
outer_region = cad.region(loop=[l1, l2, l3, l4], inside=(100, 0))
inner_region = cad.region(loop=[c1], inside=(0, 0))
outer = cad.extrude("xy", outer_region, 30, quality="high")
inner = cad.extrude("xy", inner_region, 30, quality="high")
plate = cad.bool_difference(outer, inner, quality="high")
```

## 6.2 Multi-File Project (Helpers Next to `.py`)

Folder layout:

```text
MyProject/
  main.py
  CADpolygons.py
  CADgears.py
```

`main.py`:

```python
from flywheelcad import *
from CADpolygons import regular_polygon
from CADgears import gear_outline

cad = FlywheelCAD()

cad.with_sketch("xy")
regular_polygon(center_x=0, center_y=0, side_count=6, radius=80, plane_name="xy")

gear = gear_outline(center_x=260, center_y=0, tooth_count=18, module=5.0, plane_name="xy")
body = cad.extrude("xy", cad.region(loop=gear["profile"], inside=gear["profile_inside"]), 35, quality="high")
bore = cad.extrude("xy", cad.region(loop=[gear["bore"]], inside=gear["bore_inside"]), 35, quality="high")
gear_body = cad.bool_difference(body, bore, quality="high")
```

## 6.3 Custom Plane From Body Topology

```python
from flywheelcad import *
cad = FlywheelCAD()

cad.with_sketch("xy")
p1 = cad.point2d(-40, -40)
p2 = cad.point2d(40, -40)
p3 = cad.point2d(40, 40)
p4 = cad.point2d(-40, 40)
l1 = cad.line2d(p1, p2)
l2 = cad.line2d(p2, p3)
l3 = cad.line2d(p3, p4)
l4 = cad.line2d(p4, p1)

body = cad.extrude("xy", cad.region(loop=[l1, l2, l3, l4], inside=(0, 0)), 40)

top_plane = cad.create_sketch_plane(body.v0, body.v1, body.v2, name="top_plane_a")
cad.with_sketch("top_plane_a")
c1 = cad.circle2d(origin_top_plane_a, 12)
cap = cad.extrude("top_plane_a", cad.region(loop=[c1], inside=(0, 0)), 20)
```

## 7. Included Examples

Two sets of ready-to-run examples ship alongside the app.

**`TestProjects/`** — focused, single-feature demos, indexed in
`TestProjects/EXAMPLES.md`. Among them:

- Sketching & constraints: `test_drawing.py`, `test_constraints.py`,
  `test_sketch_planes.py`, `test_trim.py`
- Bodies: `test_extrude_revolve.py`, `test_extrude_draft.py`,
  `test_extrude_offset.py`, `test_extrude_rounded_corners.py`,
  `test_edge_rounding.py`, `test_loft.py`, `test_offset.py`
- Booleans & analysis: `test_boolean.py`, `test_boolean_ops.py`,
  `test_smooth_booleans.py`, `test_section_project.py`
- Gears & airfoils (parametric helper modules): `test_gears.py`,
  `test_helical_gears.py`, `test_herringbone_gears.py`, `CADgears.py`,
  `naca_4412.py`, `twisted_NACA_4412.py`

**`Samples/`** — complete multi-file assemblies:

- `AirplaneNested/` — a two-level nested assembly with mates and colors
- `ToyAirplane/`, `Glider/`, `FlyingWing/` — airframes built from
  imported profile/wing/fuselage modules
- `MotorMount/` — a standard-library showcase: a NEMA 17 stepper, a servo +
  control horn, cap screws, and a 608 bearing placed from the component
  library (its vendored `lib/standard/` travels with the sample)

These are good templates for building your own designs and helper libraries.

## 8. Troubleshooting

### 8.1 `Unknown sketch context '...'`

- Use canonical plane names (`xy`, `yz`, `zx`) or an existing custom sketch name.
- Avoid legacy `_plane` suffix.

### 8.2 `No region traces loop (...)`

- Loop element names must resolve to existing sketch elements in the active plane.
- The loop must list the boundary elements in traversal order (rotation-invariant and reversal-lenient); use `rev(e)` to mark an element traversed against its intrinsic direction.
- The `inside` point is optional, but when several regions trace the same loop it disambiguates them — it must lie in the intended region's material (not inside a hole).

### 8.3 Helper Module Import Fails

- Confirm helper `.py` is in the same folder as the `.py` file, or otherwise reachable on `PYTHONPATH`.
- Confirm module/file names match import names exactly.

### 8.4 Script Runs but Geometry Did Not Change

- Check for plain Python mistakes first.
- Prefer explicit API calls (`cad.length`, `cad.radius`, `cad.distance`, etc.) for dimensions.
- Use the script panel error line to locate runtime/validation failures quickly.

## 9. Practical Workflow Recommendation

1. Rough in geometry in UI.
2. Add constraints and dimensions from dropdowns.
3. Open Variables panel and name shared dimensions.
4. Use script panel as source-of-truth for repeatability.
5. Move reusable generation logic into sibling helper modules.
6. Keep feature scripts small and composable by import.
