package net.neoforged.neoforge.client.model.quad;

import org.joml.Vector3f;

import com.mojang.math.Transformation;

import net.minecraft.client.resources.model.geometry.BakedQuad;

/**
 * Fabric port of NeoForge's quad transformation helpers (vanilla quads carry no per-vertex normals or colors).
 */
public final class QuadTransforms {
    private QuadTransforms() {
    }

    public static BakedQuad applyTransformation(BakedQuad quad, Transformation transformation) {
        if (transformation.equals(Transformation.IDENTITY)) {
            return quad;
        }
        var matrix = transformation.getMatrix();
        var p = new Vector3f[4];
        for (int i = 0; i < 4; i++) {
            p[i] = matrix.transformPosition(new Vector3f(quad.position(i)));
        }
        var direction = net.minecraft.core.Direction.rotate(matrix, quad.direction());
        return new BakedQuad(p[0], p[1], p[2], p[3], quad.packedUV0(), quad.packedUV1(), quad.packedUV2(),
                quad.packedUV3(), direction, quad.materialInfo());
    }
}
