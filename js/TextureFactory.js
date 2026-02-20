export default class TextureFactory {
    
    // 1. STYLE A RECTANGLE (Now accepts a textureKey)
    static styleRectangle(scene, x, y, width, height, body, textureKey) {
        // A. The Base (Tiled)
        const block = scene.add.tileSprite(x, y, width, height, textureKey);
        
        // Sync rotation with physics body if needed
        if (body) {
            block.setRotation(body.angle);
            // Set depth so it renders behind the player (100) but in front of background (-10)
            block.setDepth(-1);
        }
    }

    // 2. STYLE A CURVE (Now accepts a textureKey)
    static styleCurve(scene, body, textureKey) {
        const shapeGraphics = scene.make.graphics();
        shapeGraphics.fillStyle(0xffffff);

        const drawPoly = (verts) => {
            shapeGraphics.beginPath();
            shapeGraphics.moveTo(verts[0].x, verts[0].y);
            for (let i = 1; i < verts.length; i++) {
                shapeGraphics.lineTo(verts[i].x, verts[i].y);
            }
            shapeGraphics.closePath();
            shapeGraphics.fillPath();
        };

        if (body.parts && body.parts.length > 1) {
            for (let i = 1; i < body.parts.length; i++) {
                drawPoly(body.parts[i].vertices);
            }
        } else {
            drawPoly(body.vertices);
        }

        const geometryMask = shapeGraphics.createGeometryMask();
        const artContainer = scene.add.container(0, 0);
        artContainer.setDepth(-1); 

        const minX = body.bounds.min.x;
        const minY = body.bounds.min.y;
        const width = body.bounds.max.x - minX;
        const height = body.bounds.max.y - minY;

        // Use the dynamic textureKey here
        const block = scene.add.tileSprite(
            minX + width / 2,
            minY + height / 2,
            width,
            height,
            textureKey
        );
        
        block.setRotation(body.angle);
        artContainer.add(block);
        artContainer.setMask(geometryMask);
    }

    // 3. STYLE A CIRCLE (Now accepts a textureKey)
    static styleCircle(scene, body, textureKey) {
        const radius = body.circleRadius;
        const x = body.position.x;
        const y = body.position.y;

        const shapeGraphics = scene.make.graphics();
        shapeGraphics.fillStyle(0xffffff);
        shapeGraphics.fillCircle(x, y, radius);

        const geometryMask = shapeGraphics.createGeometryMask();
        const artContainer = scene.add.container(0, 0);
        artContainer.setDepth(-1);

        const block = scene.add.tileSprite(x, y, radius * 2, radius * 2, textureKey);
        block.setRotation(body.angle);

        artContainer.add(block);
        artContainer.setMask(geometryMask);
    }
}