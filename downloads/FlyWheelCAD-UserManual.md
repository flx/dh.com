# FlyWheelCAD User Manual

## 1. What FlyWheelCAD Is

FlyWheelCAD is a Python-first, constraint-driven CAD application.

- You draw and edit sketches interactively in the UI.
- You can also script everything in `.fwcad` files (which are plain Python files).
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

## 4.1 `.fwcad` Files

A `.fwcad` file is plain Python that imports `flywheelcad`:

```python
from flywheelcad import *
cad = FlyWheelCAD()
```

When executed, this Python script emits intermediate CAD commands to stdout; the app parses and executes those commands.

## 4.2 Local Python Modules

You can place helper `.py` files next to your `.fwcad` file and import them directly.

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
- `cad.circletangentline(circle=c1, line=l1)`
- `cad.circletangentcircle(circle1=c1, circle2=c2)`
- `cad.ellipsetangentline(ellipse=e1, line=l1)`
- `cad.equallines(line1=l1, line2=l2)`
- `cad.equalradius(circle1=c1, circle2=c2)`

### 5.4 Dimensions and Variables

- `d1 = cad.variable(100.0, fixed=True)`
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
- `cad.ensure_convergence()`

### 5.6 3D Operations

- `cad.extrude(plane, boundary, inside, distance, direction=None, quality=None)`
- `cad.revolve(plane, boundary, inside, axis, angle, quality=None)`
- `cad.bool_union(body1, body2, ..., quality=None)`
- `cad.bool_difference(bodyA, bodyB, ..., quality=None)`
- `cad.bool_intersection(body1, body2, ..., quality=None)`
- `cad.section(body, plane)`
- `cad.project(body, plane)`
- `cad.project_point(point, plane)`

Quality values: `"preview"`, `"standard"`, `"high"`, `"ultra"`.

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
outer = cad.extrude("xy", [l1, l2, l3, l4], (0, 0), 30, quality="high")
inner = cad.extrude("xy", [c1], (0, 0), 30, quality="high")
plate = cad.bool_difference(outer, inner, quality="high")
```

## 6.2 Multi-File Project (Helpers Next to `.fwcad`)

Folder layout:

```text
MyProject/
  main.fwcad
  CADpolygons.py
  CADgears.py
```

`main.fwcad`:

```python
from flywheelcad import *
from CADpolygons import regular_polygon
from CADgears import gear_outline

cad = FlyWheelCAD()

cad.with_sketch("xy")
regular_polygon(center_x=0, center_y=0, side_count=6, radius=80, plane_name="xy")

gear = gear_outline(center_x=260, center_y=0, tooth_count=18, module=5.0, plane_name="xy")
body = cad.extrude("xy", gear["profile"], gear["profile_inside"], 35, quality="high")
bore = cad.extrude("xy", [gear["bore"]], gear["bore_inside"], 35, quality="high")
gear_body = cad.bool_difference(body, bore, quality="high")
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

body = cad.extrude("xy", [l1, l2, l3, l4], (0, 0), 40)

top_plane = cad.create_sketch_plane(body.v0, body.v1, body.v2, name="top_plane_a")
cad.with_sketch("top_plane_a")
c1 = cad.circle2d(origin_top_plane_a, 12)
cap = cad.extrude("top_plane_a", [c1], (0, 0), 20)
```

## 7. Included Repository Examples

This repo contains ready-to-run imported examples:

- `TestProjects/test.fwcad`
- `TestProjects/test_polygons.fwcad`
- `TestProjects/test_gears.fwcad`
- `TestProjects/test_showcase.fwcad`
- `TestProjects/CADtriangle.py`
- `TestProjects/CADpolygons.py`
- `TestProjects/CADgears.py`

These are good templates for building your own helper libraries.

## 8. Troubleshooting

### 8.1 `Unknown sketch context '...'`

- Use canonical plane names (`xy`, `yz`, `zx`) or an existing custom sketch name.
- Avoid legacy `_plane` suffix.

### 8.2 `No area matches boundary=[...]`

- The boundary list and `inside` point must identify the same closed region.
- If the boundary has holes, the inside point must be in the intended material region.
- For ring-like geometry, center points may fall into the hole and fail selection.

### 8.3 Helper Module Import Fails

- Confirm helper `.py` is in the same folder as the `.fwcad` file, or otherwise reachable on `PYTHONPATH`.
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

