DenX Animator — Bones V2 Rigid Rotation

What changed:
- Smaller visible round nodes.
- Smaller MAIN/root square.
- Large invisible hit areas stay behind them for easier thumb control.
- Selected node keeps the DenX cyan glow.
- Bone lengths are now fixed.
- Dragging any non-root node rotates it around its parent pivot.
- All descendants rotate with that node, preserving the branch shape.
- Root square still moves the entire figure without deformation.
- New custom segments permanently remember the length they were created with.

This directly targets the two V1 issues:
1. oversized nodes
2. rubber/stretchy and weird parent-branch movement
