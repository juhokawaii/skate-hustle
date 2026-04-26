export default class TextureFactory {

    static getConcreteMaskData(scene) {
        if (!scene.__concreteGraffitiMaskData) {
            const graphics = scene.make.graphics();
            graphics.fillStyle(0xffffff);
            scene.__concreteGraffitiMaskData = {
                graphics,
                mask: graphics.createGeometryMask()
            };
        }
        return scene.__concreteGraffitiMaskData;
    }

    static addConcretePolygon(scene, vertices) {
        if (!vertices || vertices.length === 0) {
            return;
        }

        const { graphics } = TextureFactory.getConcreteMaskData(scene);
        graphics.beginPath();
        graphics.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i++) {
            graphics.lineTo(vertices[i].x, vertices[i].y);
        }
        graphics.closePath();
        graphics.fillPath();
    }

    static addConcreteCircle(scene, x, y, radius) {
        const { graphics } = TextureFactory.getConcreteMaskData(scene);
        graphics.fillCircle(x, y, radius);
    }

    static ensureGrayscaleTexture(scene, sourceKey, targetKey) {
        if (scene.textures.exists(targetKey)) {
            return;
        }

        const source = scene.textures.get(sourceKey)?.getSourceImage();
        if (!source) {
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const lum = Math.round((0.299 * r) + (0.587 * g) + (0.114 * b));
            pixels[i] = lum;
            pixels[i + 1] = lum;
            pixels[i + 2] = lum;
        }

        ctx.putImageData(imageData, 0, 0);
        scene.textures.addCanvas(targetKey, canvas);
    }

    static isConcreteTexture(textureKey) {
        return textureKey === 'platform_texture' || textureKey === 'bottomrace_platform_texture';
    }

    static getGraffitiTagCount(width, height) {
        const area = width * height;
        const byWidth = Math.floor(width / 500);
        const byArea = Math.floor(area / 250000);
        const maxTags = Math.max(1, byWidth, byArea);
        return Phaser.Math.Between(1, maxTags);
    }
    
    // 1. STYLE A RECTANGLE (Now accepts a textureKey)
    static styleRectangle(scene, x, y, width, height, body, textureKey) {
        // A. The Base (Tiled)
        const block = scene.add.tileSprite(x, y, width, height, textureKey);
        
        // Sync rotation with physics body if needed
        if (body) {
            block.setRotation(body.angle);
            // Set depth so it renders behind the player (100) but in front of background (-10)
            const isGround = textureKey === 'ground';
            block.setDepth(isGround ? 0 : -1);
        }

        if (!TextureFactory.isConcreteTexture(textureKey)) {
            return;
        }

        if (body && body.vertices && body.vertices.length > 0) {
            TextureFactory.addConcretePolygon(scene, body.vertices);
        } else {
            TextureFactory.addConcretePolygon(scene, [
                { x: x - (width / 2), y: y - (height / 2) },
                { x: x + (width / 2), y: y - (height / 2) },
                { x: x + (width / 2), y: y + (height / 2) },
                { x: x - (width / 2), y: y + (height / 2) }
            ]);
        }

        const tagCount = TextureFactory.getGraffitiTagCount(width, height);
        const minX = x - (width / 2);
        const maxX = x + (width / 2);
        const minY = y - (height / 2);
        const maxY = y + (height / 2);
        const { mask } = TextureFactory.getConcreteMaskData(scene);

        for (let i = 0; i < tagCount; i++) {
            const tag = scene.add.image(
                Phaser.Math.Between(minX, maxX),
                Phaser.Math.Between(minY, maxY),
                'graffiti',
                Phaser.Math.Between(0, 7)
            );

            tag.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
            tag.setScale(Phaser.Math.FloatBetween(0.5, 1.0));
            tag.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
            tag.setDepth(block.depth + 0.1);
            tag.setMask(mask);
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

        if (TextureFactory.isConcreteTexture(textureKey)) {
            if (body.parts && body.parts.length > 1) {
                for (let i = 1; i < body.parts.length; i++) {
                    TextureFactory.addConcretePolygon(scene, body.parts[i].vertices);
                }
            } else {
                TextureFactory.addConcretePolygon(scene, body.vertices);
            }

            const { mask } = TextureFactory.getConcreteMaskData(scene);
            const tagCount = TextureFactory.getGraffitiTagCount(width, height);

            for (let i = 0; i < tagCount; i++) {
                const tag = scene.add.image(
                    Phaser.Math.Between(minX, minX + width),
                    Phaser.Math.Between(minY, minY + height),
                    'graffiti',
                    Phaser.Math.Between(0, 7)
                );

                tag.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
                tag.setScale(Phaser.Math.FloatBetween(0.5, 1.0));
                tag.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
                tag.setBlendMode(Phaser.BlendModes.MULTIPLY);
                tag.setDepth(artContainer.depth + 0.1);
                tag.setMask(mask);
            }
        }

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

        if (TextureFactory.isConcreteTexture(textureKey)) {
            TextureFactory.addConcreteCircle(scene, x, y, radius);

            const { mask } = TextureFactory.getConcreteMaskData(scene);
            const diameter = radius * 2;
            const tagCount = TextureFactory.getGraffitiTagCount(diameter, diameter);

            for (let i = 0; i < tagCount; i++) {
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const distance = Math.sqrt(Phaser.Math.FloatBetween(0, 1)) * radius;
                const tag = scene.add.image(
                    x + Math.cos(angle) * distance,
                    y + Math.sin(angle) * distance,
                    'graffiti',
                    Phaser.Math.Between(0, 7)
                );

                tag.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
                tag.setScale(Phaser.Math.FloatBetween(0.5, 1.0));
                tag.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
                tag.setBlendMode(Phaser.BlendModes.MULTIPLY);
                tag.setDepth(-0.9);
                tag.setMask(mask);
            }
        }

        artContainer.add(block);
        artContainer.setMask(geometryMask);
    }
}