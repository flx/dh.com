# FlywheelCAD — Python Scripting Guide for Coding Agents

This is a task-oriented reference for an LLM/coding agent authoring a FlywheelCAD
design **in Python**. It covers the mental model, the full API surface, the rules
that are easy to get wrong, and complete worked examples.

The authoritative API is `FlyWheelCADV3/Resources/flywheelcad.py`. Runnable
example scripts live in `TestProjects/` (indexed in `TestProjects/EXAMPLES.md`)
and `Samples/`. When in doubt, read those.

---

## 1. The model in 60 seconds

- A FlywheelCAD **document _is_ a Python script.** Opening it re-executes the
  script to rebuild the geometry; saving writes the script. There is no separate
  binary model — **the script is the source of truth.** Write scripts that fully
  reconstruct the design from scratch, deterministically. (A document is either
  a flat `.py` or a `.fwcad` project bundle — a folder whose `main.py` is the
  script; the API is identical either way.)
- The script doesn't manipulate the model directly. Each `cad.*(...)` call
  **emits a command**; the host runs them in order: solve 2D sketches with a
  constraint solver, then build 3D solids.
- The pipeline is always **2D sketch → region → 3D solid**. You draw constrained
  2D geometry on a plane, identify a closed **region**, then `extrude`/`revolve`/
  `loft` it into a body. Bodies combine via booleans and transforms.
- Units are unitless numbers (treat as millimetres). Angles are **degrees**.

---

## 2. File skeleton

Every script starts the same way:

```python
from flywheelcad import *
cad = FlywheelCAD()

# ... build the design ...
```

That's the entire boilerplate. `from flywheelcad import *` also brings in a few
free functions used below: `region(...)`, `rev(...)`, `cw(...)`, `ccw(...)`,
`ref(...)`.

---

## 3. Rules an agent MUST follow

These prevent the most common generation errors:

1. **Assign every created element to a distinctly-named variable.** The element's
   internal name is derived from the **left-hand-side variable name** via source
   introspection. `l1 = cad.line2d(p1, p2)` names the line `l1`. Then reference it
   as `l1` everywhere else.
   - Use unique names. Don't reuse a variable for two different elements.
   - Don't rename via plain aliasing (`x = l1`) and expect a new element.
2. **Order matters.** A line needs its points to exist first; a region needs its
   boundary elements; a body needs its region; a boolean needs its input bodies;
   a mate needs the instances and their exported anchors. Emit in dependency order.
3. **Set the sketch plane before drawing 2D geometry:** `cad.with_sketch("xy")`.
   All subsequent `point2d/line2d/...` land on that plane until you switch.
4. **Plane names are the strings `"xy"`, `"yz"`, `"zx"`** for the three standard
   planes. Custom planes are refs returned by `cad.create_sketch_plane(...)`.
5. **Coordinates in `point2d` and `region(inside=...)` are 2D sketch coordinates**
   on the current plane, not world coordinates.
6. **Re-execution must be deterministic.** No `random`, no wall-clock, no reading
   external state that changes between runs. Helper functions and loops are fine
   and encouraged for repetitive geometry.

---

## 4. Sketching (2D)

### 4.1 Planes & sketch context

```python
cad.with_sketch("xy")     # draw on the standard XY plane (also "yz", "zx")
# ... 2D geometry here ...
cad.with_sketch("yz")     # switch planes; later geometry lands on YZ
```

### 4.2 Primitives

All 2D primitives take/return points and live on the current sketch:

```python
p1 = cad.point2d(0, 0)                      # a 2D point
l1 = cad.line2d(p1, p2)                      # a line between two points
c1 = cad.circle2d(center_pt, radius=10)      # circle (center point + radius)
e1 = cad.ellipse2d(focus1, focus2, point)    # ellipse from two foci + a rim point
a1 = cad.arc2d(center, start, end, clockwise=False)   # arc; endpoints on the circle
s1 = cad.spline2d([p0, p1, p2, p3], closed=False)     # cubic spline through points

# 3D reference points (world coords) — for custom planes / anchors:
P = cad.point(10, 0, 5)
```

Add `construction=True` to any primitive to make it a **construction element**
(guides/axes/symmetry lines; rendered dashed, excluded from region detection):

```python
axis = cad.line2d(b, t, construction=True)
```

`cad.trim(element, near=(x, y))` trims in place at the nearest intersection and
returns `(element, split_piece)`; the original variable becomes the surviving
piece.

### 4.3 Geometric constraints (no return value)

```python
cad.horizontal(l1);  cad.vertical(l2)
cad.parallel(l1, l2);  cad.perpendicular(l1, l2)
cad.collinear(l1, l2)
cad.coincident(p1, p2)                 # merge two points
cad.pointlinecoincident(p, l)          # point lies on line
cad.pointoncircle(p, c);  cad.pointonellipse(p, e);  cad.pointonplane(p, plane)
cad.concentric(c1, c2)
cad.equallines(l1, l2);  cad.equalradius(c1, c2)
cad.circletangentline(c, l);  cad.circletangentcircle(c1, c2)
cad.ellipsetangentline(e, l);  cad.splinetangentline(s, l)
cad.symmetryline(...);  cad.symmetryplane(...)
```

### 4.4 Dimensions (pin a measured value)

```python
cad.length(l1, 40)             # line length
cad.distance(p0, p1, 25)       # point-to-point distance
cad.radius(c1, 8)              # circle radius
cad.angle(l1, l2, 90)          # angle between two lines (degrees)
cad.pointlinedistance(p, l, 5) # perpendicular point-to-line distance
```

A value can be a number, a **variable**, or an **expression** of variables.

### 4.5 Variables (parametric dimensions)

```python
w = cad.variable(40, driving=True)   # editable driving dimension (default for params)
cad.length(l1, w)                    # bind a dimension to it
cad.length(l2, w * 0.5)              # expressions work (+, -, *, /)

# fixed=True  -> permanent constant (never moves)
# driving=True -> pinned during solves but editable via the UI / cad.update(...)
# (neither)    -> a free unknown the solver may move
```

Edit a driving value programmatically (re-solves afterward):

```python
cad.update({w: {"value": 60}})
```

### 4.6 Other sketch ops

```python
cad.mirror([l1, l2, c1], symmetry_line=axis)   # mirror elements across a line
cad.merge_points(p_src, p_dst)                  # weld two points
cad.ensure_convergence()                        # force a solve of the current sketch

# Round the corner where two elements (lines OR arcs, any mix) share an
# endpoint: both retract to the tangent points and a tangent arc bridges them
# (tangency + radius are constrained, so the fillet stays valid on re-solve).
# The element variables keep referring to the retracted elements; the returned
# arc goes into region loops between them: region(loop=[l1, f1, l2, ...]).
# Rejected when the join is already tangent-continuous (no corner) or the
# radius doesn't leave part of both elements.
f1 = cad.fillet(l1, l2, radius=4)
f2 = cad.fillet(l3, a1, radius=2)   # line–arc and arc–arc corners work too
```

---

## 5. Regions — the bridge from 2D to 3D

A **region** is the closed area a solid is built from. It is identified by a
**directed boundary loop**, optional **holes**, and an optional **inside point**:

```python
r = cad.region(
    loop=[l1, l2, l3, l4],     # ordered boundary; consecutive elements share endpoints
    holes=[[hole_circle]],     # list of hole loops (each a list of elements)
    inside=(x, y),             # a point KNOWN to be inside the material (2D coords)
)
```

- `loop` is **directed**: list the boundary elements in traversal order. If an
  element runs against its natural direction in the loop, wrap it with `rev(...)`:
  `loop=[c1, rev(l4)]`.
- `holes` cut material; each hole is its own loop list.
- `inside=(x, y)` disambiguates when one boundary could enclose two areas
  (e.g. concentric circles). Give a point clearly in the solid material. When the
  loop is unambiguous you can omit it, but **including it is safer** — always
  include `inside` for any region with holes or multiple candidate faces.

`region(...)` (top-level) and `cad.region(...)` are equivalent.

---

## 6. Bodies (3D)

Every body call returns a **body ref** (e.g. `body1`) you reuse downstream.
Common keyword args across body ops: `quality=` (`"preview"`/`"standard"`/
`"high"`/`"ultra"`), `edge_radius=` (uniform fillet), `export=False` (exclude from
3MF export).

### 6.1 Extrude

```python
body = cad.extrude("xy", region, distance,
                   direction=None,      # None = one-way along +normal; "symmetric" = both ways
                   edge_radius=0,       # fillet all edges by this radius
                   offset=0,            # shift the whole body off the plane along the normal
                   draft=0,             # taper walls by this angle (deg); + = outward
                   twist=0,             # total twist (deg) of the cross-section over the height
                   twist_center=None,   # 2D pivot for the twist (default: region centroid)
                   quality=None, export=None)
```

### 6.2 Revolve

```python
rbody = cad.revolve("xy", region, axis, angle,   # axis is a (construction) line; angle in degrees
                    edge_radius=0, quality=None)
# angle=360 for a full body of revolution; <360 for a partial revolve.
```

### 6.3 Loft & multi-loft

```python
# Two profiles on two (possibly non-parallel) planes:
lbody = cad.loft(start_plane, start_region, end_plane, end_region, edge_radius=0)

# One smooth solid through N>=2 sections (no internal seams) — preferred over
# chaining 2-section lofts + unions:
mbody = cad.multi_loft([plane0, plane1, plane2], [region0, region1, region2])
```

### 6.4 Booleans (variadic; keep-result, consume inputs)

```python
u = cad.bool_union(a, b)            # or more: bool_union(a, b, c, ...)
d = cad.bool_difference(box, tool)  # first minus the rest
i = cad.bool_intersection(a, b)

# Blended seams:
cad.bool_union(a, b, blend="smooth", radius=2)     # rounded fillet at the seam
cad.bool_difference(a, b, blend="chamfer", radius=2)  # flat 45° bevel
```

### 6.5 Offset / shell

```python
big = cad.offset(box,  2)    # grow outward in every direction
small = cad.offset(box, -2)  # shrink inward
shell = cad.bool_difference(big, small)   # hollow shell
```

### 6.6 Body transforms (keep-both: source stays, a NEW body is returned)

```python
b2 = cad.move(b, dx=10, dy=0, dz=0)
b3 = cad.rotate(b, axis=(0, 0, 1), angle=45, center=(0, 0, 0))
b4 = cad.scale(b, factor=2)                 # or sx=/sy=/sz= for per-axis
b5 = cad.mirror_body(b, plane="yz")
b6 = cad.copy(b)
cad.delete_body(b)                          # delete (cascades to consumers)
```

### 6.7 Topology points & custom planes

After an extrude/revolve, the body exposes its **far-face vertices** as
attributes, which you can use as 3D defining points for a custom sketch plane:

```python
box = cad.extrude("xy", rect_region, 20)
plane = cad.create_sketch_plane(box.v0, box.v1, box.v2)   # oblique plane on the top face
cad.with_sketch(plane)
# ... draw on the new plane, e.g. a circle, then extrude/loft from it ...
```

Vertex names follow `body.v0, body.v1, ...` (holes: `body.h0_v0`; symmetric
extrudes split into `body.pos_v0` / `body.neg_v0`). The exact set depends on the
body — when unsure, prefer building reference geometry with `cad.point(x,y,z)`
and `create_sketch_plane`.

### 6.8 Analysis (snapshots, refreshed on full re-run)

```python
s = cad.section(body, "yz")        # cross-section curve at a plane
sp = cad.project(body, "yz")       # silhouette projection onto a plane
pp = cad.project_point(box.v0, "zx")
```

---

## 7. Colors & finishes (display + 3MF)

Display-only; does not affect geometry. Set on any body:

```python
cad.set_color(body, "#C62828", finish="glossy")    # hex
cad.set_color(body, "red")                          # named color (defaults to glossy)
cad.extrude("xy", r, 10).set_color((0.2, 0.4, 1.0), finish="metallic")  # chainable, RGB tuple
```

- Color: `"#RRGGBB"`, `"#RRGGBBAA"` (alpha = translucency), `"#RGB"`, a name
  (`red`, `blue`, `steel`, `gold`, …), or an `(r, g, b[, a])` tuple (0–1 or 0–255).
- `finish`: `"matte"`, `"glossy"`, `"metallic"`, `"glass"` (glass is translucent).
- Colors are written into the 3MF export as base-material colors.
- Colors set **inside a component** propagate to every instance of it.

### Mesh resolution: `set_cell_size`

Sampled meshing (booleans, offsets, lofts, rounded/drafted extrudes) uses a
quality tier whose cell budget is RELATIVE to the body's size — a large body
gets large cells, so small features (grooves, pockets, thin rods) can lose
detail even at `quality="ultra"`. Give such a body an ABSOLUTE cell size in
model units:

```python
wing = cad.bool_difference(skin, groove, bay)
cad.set_cell_size(wing, 0.8)      # 0.8-unit cells regardless of body size
wing.set_cell_size(0.8)           # chainable form
```

Clamped to a hard total-cell cap (the console warns when the clamp engages).
Exactly-meshed plain extrudes/revolves ignore it (they are already exact).

---

## 8. Components & assemblies

Use components to define a reusable part once and place it many times. Components
are defined **flat** (never nest `with` blocks) and nested **by reference**.

### 8.1 Define a component

```python
with cad.component("bracket"):
    cad.with_sketch("xy")
    # ... sketch + region ...
    body = cad.extrude("xy", r, 5)
    cad.set_color(body, "steel", finish="metallic")
    cad.export(body)                      # assembly-visible result
    cad.export_point("hole", cad.point(10, 0, 0))   # named anchor for mating
```

- `cad.export(body, name="friendly")` marks a body as a visible part of the
  component. A multi-body component exports several; each surfaces on an instance
  as `<instance>_<name>`.
- `cad.export_point("anchor", point)` promotes a reference point; each instance
  exposes it as `<instance>.<anchor>` (e.g. `b1.hole`), usable in assembly
  geometry, mates, and as a target for other parts.
- A component that is **never instanced** in a run is *transparent*: it builds the
  top-level design. So a component file run directly behaves like a normal part.

### 8.2 Parametric components

Build a distinct component per parameter set, memoized by parameters:

```python
def make_wing(span, chord):
    def build():
        cad.with_sketch("xy")
        # ... use span/chord ...
        cad.export(skin)
    return cad.parametric("wing", build, span=span, chord=chord)

WING = make_wing(span=46, chord=18)   # returns a component name
```

### 8.3 Instance & place

```python
b1 = cad.instance("bracket")                          # at the origin
b2 = cad.instance("bracket", translate=(50, 0, 0))    # placed
b3 = cad.instance("bracket", mirror="zx")             # mirrored
b4 = cad.instance(WING, scale=2, angle=10, axis=(0,0,1))  # transforms compose
```

An instance ref is usable anywhere a body is (booleans, transforms, `set_color`).

### 8.4 Mates (position instances relative to each other)

```python
# Closed-form snap: instance's anchor coincides with a target point (+offset):
cad.mate_coincident(b2, "hole", b1.hole, offset=(0, 0, 5))

# Snap + orient: align anchor1->anchor2 direction to target1->target2:
cad.mate_align(b2, "a1", "a2", t1, t2)

# Solved 6-DOF pose: several mate() on one instance are solved together
# (e.g. three point mates fully fix position AND orientation):
cad.mate(b2, "p0", target0)
cad.mate(b2, "p1", target1)
cad.mate(b2, "p2", target2)
```

### 8.5 Nesting & multi-file projects

- Components nest by **instancing** other components inside a `with cad.component`
  block, then re-exporting the instance: `panel = cad.instance(WING); cad.export(panel)`.
- Larger projects split components into sibling `.py` files imported by an
  assembly file. The folder is on the import path, so `import fuselage` resolves a
  sibling `fuselage.py`. Each component file defines (and may instance) its part.
  See `Samples/AirplaneNested/` for a two-level assembly.

### 8.6 Component libraries (vendored parts)

Reusable catalog parts (motors, bearings, fasteners) come from **component
libraries** — folders of ordinary Python modules. The **standard library** ships
inside the app; users can add custom library folders. Documents consume library
parts **copy-on-use**: the module is copied ("vendored") into the document
folder under `lib/<library>/`, so every document stays self-contained and old
designs never change when a library updates.

```
MyRobot/
  robot.py                  # main file
  bracket.py                # user components (siblings, as before)
  lib/
    standard/steppers.py    # vendored library modules — imported, don't edit
```

The canonical import line carries the provenance:

```python
from lib.standard.steppers import stepper

m = stepper(cad, size=17, length=48)        # -> component name (parametric)
motor = cad.instance(m, translate=(80, 0, 20))
cad.mate_coincident("bracket_1", "hole_0", "motor.bolt_0")
```

Library factories take `cad` as the first argument, return a component name for
`cad.instance(...)`, and export a **documented anchor contract** so parts can be
mated without reading their source. Treat files under `lib/` as read-only: they
carry a provenance header (`# flywheelcad-library: <library>/<module> <version>`)
and are refreshed wholesale by the update flow. To fork one, copy it up into the
document folder as a user component instead.

When AUTHORING a library module: reference sibling modules of the same library
with **relative imports** (`from .fasteners import bolt` / `from . import
shafts`) — those resolve both in the library folder and after vendoring, and
the copy-on-use step follows them so dependencies vendor together. Declare
`__library_version__ = "x.y"` at module top level. Factories are public
module-level functions whose first parameter is `cad`; parameter defaults and
the docstring's first line surface in the library browser.

**Standard library: `steppers`** (`from lib.standard.steppers import stepper`)

- `stepper(cad, size=17, length=None, shaft_length=None, body="square", quality=None)`
  — NEMA frame sizes 8, 11, 14, 17, 23, 34; defaults are typical catalog
  dimensions. `body="square"` is the classic end-bell frame with real bolt
  holes through the front bell, an inset lamination stack, shaft flat, and
  wire exit; `body="round"` is a cylindrical can behind a square flange.
- Orientation: mount face on the XY plane at z=0, shaft up +Z, can extends −Z.
- Anchors: `mount_face` (flange-face center), `shaft_tip`, `shaft_base`, and
  `bolt_0..3` (mounting square, CCW from (+x, +y)).

**Standard library: `servos`** (`from lib.standard.servos import servo, horn`)

- `servo(cad, size="standard", quality=None)` — hobby-servo case classes
  `"sub_micro"` (SG90), `"micro"` (MG90S), `"standard"` (S3003/HS-422 class),
  `"large"` (HS-805 class): case, mounting flange with screw holes, gear
  bosses, output spline. Orientation: flange UNDERSIDE on XY at z=0, case
  hanging −Z, spline up +Z offset toward +X. Anchors: `mount_0..N`,
  `spline_base`, `spline_tip`.
- `horn(cad, style="single", spline="standard", length=None, quality=None)` —
  control horns: `"single"`, `"double"`, `"cross"`, `"disc"`; spline classes
  `"micro"`/`"standard"`/`"large"`. Anchors: `hub` (mate onto a servo's
  `spline_tip`) and `tip` / `tip_0..N` / `rim_0..5` at the linkage holes.

**Standard library: `fasteners`** (`from lib.standard.fasteners import ...`)

- `cap_screw(cad, thread="M3", length=12)` (DIN 912), `hex_nut(cad, thread=)`
  (ISO 4032), `washer(cad, thread=)` (ISO 7089) — threads M2…M8. Screws point
  −Z with the under-head plane at z=0. Anchors: `under_head`/`head_top`/`tip`;
  nuts and washers: `bottom`/`top`.
- **Negative bodies for boolean cuts**: `clearance(cad, thread=, length=,
  head_pocket=False)` (ISO 273 medium fit + optional DIN 912 counterbore) and
  `tap(cad, thread=, length=)` (tap-drill volume). Place at the same transform
  as the screw with `export=False`, then `cad.bool_difference(part, cut)` —
  place a screw AND cut its hole in two lines.

**Standard library: `bearings`** (`from lib.standard.bearings import bearing`)

- `bearing(cad, designation="608", flanged=False)` — metric deep-groove sizes
  623/624/625/626/608/688/6000/6001/6800/6801/6900/6902; `flanged=True` adds
  the F-series locating flange at the z=0 face. Axis +Z. Anchors: `face_a`
  (z=0), `face_b`, `center`.

**Standard library: `extrusions`** (`from lib.standard.extrusions import rail`)

- `rail(cad, profile="2020", length=100)` — T-slot framing rails: 2020, 2040,
  4020, 2060, 3030, 3060, 4040, 4080. Profile on XY, extruded +Z. Anchors:
  `end_a`/`end_b` (profile centers) and `bore_a_i`/`bore_b_i` per cell center
  bore (tap for end joining).

**Standard library: `linkage`** (`from lib.standard.linkage import ...`)

- `ball_link(cad, thread="M2")`, `clevis(cad, thread="M2")` (M2/M3) — RC rod
  ends: shank along +Z from z=0, `pivot` anchor at the ball/pin center,
  `shank_end` at z=0. `pushrod(cad, diameter=2, length=80)` runs z 0→length
  with `end_a`/`end_b`. Mate pushrod ends to link shank_ends and link pivots
  to servo-horn tips.

---

## 9. Quality & performance knobs

- `quality=` per body: `"preview"` (fast, coarse) → `"standard"` → `"high"` →
  `"ultra"` (slow, fine). Use `"preview"` while iterating.
- Prefer one `multi_loft` over many 2-section lofts + unions (no seams, fewer
  bodies). Note `multi_loft` is CPU-meshed and dominates build time at high
  quality.
- `edge_radius` and twisted/draft extrudes cost more to mesh.

---

## 10. Pitfalls checklist (for generated scripts)

- [ ] `from flywheelcad import *` and `cad = FlywheelCAD()` at the top.
- [ ] `cad.with_sketch(...)` set before each batch of 2D geometry.
- [ ] Every element assigned to a unique, descriptive variable (names come from
      the LHS — don't shadow or reuse).
- [ ] Region `loop` is closed and **directed**; use `rev(...)` for reversed
      elements; include `inside=(x, y)` for any region with holes/ambiguity.
- [ ] Region `inside` and `point2d` use **sketch 2D coords**, not world coords.
- [ ] Bodies built only after their region exists; booleans after their inputs;
      mates after their instances + exported anchors.
- [ ] Angles in degrees; `revolve` uses `angle=360` for a full solid.
- [ ] Transforms are keep-both — capture the returned new body; the source stays.
- [ ] Components defined flat; nest by instancing + re-exporting, never by nested
      `with` blocks.
- [ ] No randomness / time / external mutable state (re-execution must be stable).

---

## 11. Complete worked examples

### 11.1 Parametric plate with a hole, extruded

```python
from flywheelcad import *
cad = FlywheelCAD()

W = cad.variable(40, driving=True)   # width
H = cad.variable(25, driving=True)   # height
T = 8                                # thickness

cad.with_sketch("xy")
p1 = cad.point2d(0, 0)
p2 = cad.point2d(40, 0)
p3 = cad.point2d(40, 25)
p4 = cad.point2d(0, 25)
l1 = cad.line2d(p1, p2)
l2 = cad.line2d(p2, p3)
l3 = cad.line2d(p3, p4)
l4 = cad.line2d(p4, p1)
cad.horizontal(l1); cad.horizontal(l3)
cad.vertical(l2);   cad.vertical(l4)
cad.length(l1, W);  cad.length(l2, H)     # driven by variables

center = cad.point2d(20, 12.5)
hole = cad.circle2d(center, 5)
cad.radius(hole, 5)

plate_region = cad.region(loop=[l1, l2, l3, l4], holes=[[hole]], inside=(3, 3))
plate = cad.extrude("xy", plate_region, T, edge_radius=1)
cad.set_color(plate, "steel", finish="metallic")
```

### 11.2 Revolved cup + subtracted bore (booleans)

```python
from flywheelcad import *
cad = FlywheelCAD()

cad.with_sketch("xy")
# Closed rectangular profile (x = radius 0..20, y = height 0..40). The left edge
# l4 sits on x = 0 and doubles as the revolution axis. NOTE the loop is built
# from REAL lines — never put a construction element in a region loop (they are
# excluded from region detection). If you want a separate construction axis,
# offset the profile so it does not touch it (see test_extrude_revolve.py).
a = cad.point2d(0, 0)
b = cad.point2d(20, 0)
c = cad.point2d(20, 40)
d = cad.point2d(0, 40)
l1 = cad.line2d(a, b); l2 = cad.line2d(b, c); l3 = cad.line2d(c, d); l4 = cad.line2d(d, a)
profile = cad.region(loop=[l1, l2, l3, l4], inside=(5, 20))
solid = cad.revolve("xy", profile, l4, 360)     # axis = the left edge (x = 0)

# Hollow it: a smaller cylinder subtracted from the top.
cad.with_sketch("xy")
bore_center = cad.point2d(0, 0)
bore = cad.circle2d(bore_center, 16)
bore_solid = cad.extrude("xy", cad.region(loop=[bore], inside=(0, 0)), 36, offset=4)
cup = cad.bool_difference(solid, bore_solid)
cad.set_color(cup, "#1565C0", finish="glossy")
```

### 11.3 Small assembly: a component placed twice and colored

```python
from flywheelcad import *
cad = FlywheelCAD()

with cad.component("peg"):
    cad.with_sketch("xy")
    ctr = cad.point2d(0, 0)
    circ = cad.circle2d(ctr, 4)
    cad.radius(circ, 4)
    body = cad.extrude("xy", cad.region(loop=[circ], inside=(0, 0)), 12)
    cad.set_color(body, "#FBC02D", finish="glossy")   # every peg is gold
    cad.export(body)
    cad.export_point("top", cad.point(0, 0, 12))

left  = cad.instance("peg", translate=(-15, 0, 0))
right = cad.instance("peg", translate=( 15, 0, 0))

# A bar bridging the two pegs' tops, snapped onto the left peg:
with cad.component("bar"):
    cad.with_sketch("xy")
    p1 = cad.point2d(0, -3); p2 = cad.point2d(30, -3)
    p3 = cad.point2d(30, 3); p4 = cad.point2d(0, 3)
    e1 = cad.line2d(p1, p2); e2 = cad.line2d(p2, p3)
    e3 = cad.line2d(p3, p4); e4 = cad.line2d(p4, p1)
    bb = cad.extrude("xy", cad.region(loop=[e1, e2, e3, e4], inside=(15, 0)), 4)
    cad.set_color(bb, "red")
    cad.export(bb)
    cad.export_point("mount", cad.point(0, 0, 0))

bar = cad.instance("bar")
cad.mate_coincident(bar, "mount", left.top)   # drop the bar onto the left peg's top
```

---

## 12. Where to look next

- `TestProjects/EXAMPLES.md` — annotated index of every example script by feature.
- `TestProjects/*.py` — focused, runnable demos (gears, lofts, booleans, drafts…).
- `Samples/AirplaneNested/` — a real multi-file nested assembly with mates + colors.
- `FlyWheelCADV3/Resources/flywheelcad.py` — the authoritative API (read the
  docstrings for exact signatures/behavior).
