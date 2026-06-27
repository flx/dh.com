# FlyWheelCAD User Manual

## 1. What FlyWheelCAD Is

FlyWheelCAD is a Python-first, constraint-driven CAD application.

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
cad = FlyWheelCAD()
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

## 4.3 Plane Naming

Use suffix-free plane names:

- Standard: `xy`, `yz`, `zx`
- Custom: your own names (for example, `endface`, `fixture_a`)

Do not use `_plane` suffix in scripts.

## 5. Python API Quick Reference

All calls below are on `cad = FlyWheelCAD()`.

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
- `cad.extrude(plane, region_intent, distance, direction=None, quality=None, edge_radius=None, offset=None, draft=None, twist=None, twist_center=None)`
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

`edge_radius` rounds every sharp edge of an extruded, revolved, or lofted body uniformly — the vertical/side edges as well as the top and bottom caps. The value is the fillet radius in model units. Omit or set to `0` for sharp edges (default).

```python
body = cad.extrude("xy", region(...), 10.0, edge_radius=1.5)
rbody = cad.revolve("xy", region(...), l1, 180.0, edge_radius=2.0)
lbody = cad.loft(start_plane="xy", ..., edge_radius=1.0)
```

#### Extrude Shaping: Draft, Offset, and Twist

Extrude takes three optional shaping parameters in addition to `edge_radius`:

- `draft` tapers the side walls by an angle in degrees, measured from the sketch-side face (which keeps the original profile size). Positive draft slopes the walls outward (the far face is larger); negative slopes inward.
- `offset` shifts the whole body along the plane normal before extruding (`0` starts on the sketch plane; negative is allowed). A body lifted off the plane exposes its bottom face as a real surface you can build a new sketch plane on.
- `twist` rotates the cross-section as it rises — the total rotation in degrees over the full `distance` — about `twist_center` (an `(x, y)` axis; defaults to the region centroid). This is how the helical and herringbone gear examples are built.

```python
# Tapered boss, lifted 5 above the plane, with rounded edges:
body = cad.extrude("xy", region(...), 20, draft=8, offset=5, edge_radius=1)

# Helical gear: a 30-degree twist over the face height about the gear centre:
gear = cad.extrude("xy", gear["region_ring"], 24, twist=30, twist_center=(0, 0))
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

- `cad.create_sketch_plane(p1, p2, p3, name=None)`

Example:

```python
endface = cad.create_sketch_plane(body1.v1, body1.v2, body1.v0, name="endface")
cad.with_sketch("endface")
```

## 6. Working Examples

## 6.1 Basic Constrained Plate With Hole

```python
from flywheelcad import *
cad = FlyWheelCAD()

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

cad = FlyWheelCAD()

cad.with_sketch("xy")
regular_polygon(center_x=0, center_y=0, side_count=6, radius=80, plane_name="xy")

gear = gear_outline(center_x=260, center_y=0, tooth_count=18, module=5.0, plane_name="xy")
# region_ring is the toothed outline with the bore already cut as a hole.
gear_body = cad.extrude("xy", gear["region_ring"], 35, quality="high")
```

## 6.3 Custom Plane From Body Topology

```python
from flywheelcad import *
cad = FlyWheelCAD()

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

## 7. Included Repository Examples

The `TestProjects` bundle contains ready-to-run examples:

- `TestProjects/test_drawing.py` — lines, construction geometry, circle, ellipse, mirror
- `TestProjects/test_constraints.py` — broad constraint and dimension sampler
- `TestProjects/test_trim.py` — trimming lines and circles into reusable fragments
- `TestProjects/test_extrude_revolve.py` — extruded plate plus a revolved feature
- `TestProjects/test_loft.py`, `TestProjects/test_sketch_planes.py` — custom planes and lofts
- `TestProjects/test_boolean.py`, `TestProjects/test_boolean_ops.py` — union, intersection, difference
- `TestProjects/test_smooth_booleans.py`, `TestProjects/test_edge_rounding.py` — blends and rounded edges
- `TestProjects/test_offset.py` — shell/offset bodies
- `TestProjects/test_section_project.py` — sections and projections from a body
- `TestProjects/test_gears.py`, `TestProjects/CADgears.py` — programmatic involute gears (arc profiles)

These are good templates for building your own helper libraries.

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
