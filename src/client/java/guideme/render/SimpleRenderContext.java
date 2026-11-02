package guideme.render;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.world.item.ItemStack;

import guideme.color.ConstantColor;
import guideme.document.LytRect;
import guideme.style.ResolvedTextStyle;

/** Minimal stand-in for GuideME's render context with only what AE2's screens use. */
public final class SimpleRenderContext {
    private final GuiGraphicsExtractor graphics;

    public SimpleRenderContext(LytRect viewport, GuiGraphicsExtractor graphics) {
        this.graphics = graphics;
    }

    public void fillRect(LytRect rect, ConstantColor color) {
        graphics.fill(rect.x(), rect.y(), rect.right(), rect.bottom(), color.argb());
    }

    public void renderTextCenteredIn(String text, ResolvedTextStyle style, LytRect rect) {
        var font = Minecraft.getInstance().font;
        var lines = font.split(net.minecraft.network.chat.Component.literal(text), Math.max(1, rect.width() - 4));
        int totalHeight = lines.size() * font.lineHeight;
        int y = rect.y() + (rect.height() - totalHeight) / 2;
        for (var line : lines) {
            int x = rect.x() + (rect.width() - font.width(line)) / 2;
            graphics.text(font, line, x, y, style.color(), style.dropShadow());
            y += font.lineHeight;
        }
    }

    public void renderItem(ItemStack stack, int x, int y, int width, int height) {
        var pose = graphics.pose();
        pose.pushMatrix();
        pose.translate(x, y);
        pose.scale(width / 16f, height / 16f);
        graphics.item(stack, 0, 0);
        pose.popMatrix();
    }
}
