package appeng.fabric.client;

import org.joml.Vector3f;

import net.minecraft.core.Direction;

/**
 * Port of NeoForge's public variant of {@code FaceBakery#recalculateWinding} operating on mutable quad data.
 * Reorders vertices so that the first vertex is the one vanilla AO expects for the given face direction.
 */
public final class ShimFaceBakery {
    private ShimFaceBakery() {
    }

    public static void recalculateWinding(Vector3f[] positions, long[] uvs, Direction direction) {
        // Find the vertex with min/max coords according to vanilla's FaceInfo convention for the face
        float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE, minZ = Float.MAX_VALUE;
        float maxX = -Float.MAX_VALUE, maxY = -Float.MAX_VALUE, maxZ = -Float.MAX_VALUE;
        for (var p : positions) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            minZ = Math.min(minZ, p.z);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
            maxZ = Math.max(maxZ, p.z);
        }
        // Target for vertex 0 per direction (matches net.minecraft.client.renderer.FaceInfo)
        float tx, ty, tz;
        switch (direction) {
            case DOWN -> {
                tx = minX;
                ty = minY;
                tz = maxZ;
            }
            case UP -> {
                tx = minX;
                ty = maxY;
                tz = minZ;
            }
            case NORTH -> {
                tx = maxX;
                ty = maxY;
                tz = minZ;
            }
            case SOUTH -> {
                tx = minX;
                ty = maxY;
                tz = maxZ;
            }
            case WEST -> {
                tx = minX;
                ty = maxY;
                tz = minZ;
            }
            default -> {
                tx = maxX;
                ty = maxY;
                tz = maxZ;
            }
        }
        int start = 0;
        for (int i = 0; i < 4; i++) {
            var p = positions[i];
            if (Math.abs(p.x - tx) < 1e-4 && Math.abs(p.y - ty) < 1e-4 && Math.abs(p.z - tz) < 1e-4) {
                start = i;
                break;
            }
        }
        if (start == 0) {
            return;
        }
        var newPos = new Vector3f[4];
        var newUv = new long[4];
        for (int i = 0; i < 4; i++) {
            newPos[i] = positions[(i + start) % 4];
            newUv[i] = uvs[(i + start) % 4];
        }
        System.arraycopy(newPos, 0, positions, 0, 4);
        System.arraycopy(newUv, 0, uvs, 0, 4);
    }
}
