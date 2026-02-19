export default class TextureFactory {
    
    // 1. STYLE A RECTANGLE (Cheap & Fast)
    static styleRectangle(scene, x, y, width, height, body) {
        // A. The Concrete Base (Tiled)
        const concrete = scene.add.tileSprite(x, y, width, height, 'platform_texture');
        
        // Sync rotation with physics body if needed
        if (body) {
            concrete.setRotation(body.angle);
            // Set depth so it renders behind the player (0) but in front of background (-10)
            concrete.setDepth(-1);
        }
    }

    // 2. STYLE A CURVE (Robust "Compound Body" Method)
    static styleCurve(scene, body) {
        // A. Create Graphics for the Mask
        const shapeGraphics = scene.make.graphics();
        shapeGraphics.fillStyle(0xffffff);

        // Helper function to draw a single set of vertices
        const drawPoly = (verts) => {
            shapeGraphics.beginPath();
            shapeGraphics.moveTo(verts[0].x, verts[0].y);
            
            for (let i = 1; i < verts.length; i++) {
                shapeGraphics.lineTo(verts[i].x, verts[i].y);
            }
            shapeGraphics.closePath();
            shapeGraphics.fillPath();
        };

        // B. Check if it's a Compound Body (Made of multiple parts)
        // Matter.js decomposes complex shapes (like curves) into multiple convex parts.
        // We need to draw ALL of them to get the true shape.
        if (body.parts && body.parts.length > 1) {
            // We skip index 0 because body.parts[0] is the "Hull" (the outer wrapper), 
            // which often looks like a simplified triangle. We want the inner parts.
            for (let i = 1; i < body.parts.length; i++) {
                drawPoly(body.parts[i].vertices);
            }
        } else {
            // Simple body (like a box or circle), just draw the main vertices
            drawPoly(body.vertices);
        }

        // C. Create the Mask
        const geometryMask = shapeGraphics.createGeometryMask();

        // D. Create Container
        const artContainer = scene.add.container(0, 0);
        artContainer.setDepth(-1); // Render behind player

        // E. The Concrete Texture
        // We calculate bounds from the physics body to know where to place the texture
        const minX = body.bounds.min.x;
        const minY = body.bounds.min.y;
        const width = body.bounds.max.x - minX;
        const height = body.bounds.max.y - minY;

        // Note: tileSprite positions are based on center, so we offset by width/2, height/2
        const concrete = scene.add.tileSprite(
            minX + width / 2,
            minY + height / 2,
            width,
            height,
            'platform_texture'
        );
        
        // Sync rotation
        concrete.setRotation(body.angle);
        
        artContainer.add(concrete);

        // F. Apply Mask
        artContainer.setMask(geometryMask);
    }
}