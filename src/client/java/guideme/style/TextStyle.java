package guideme.style;

import net.minecraft.network.chat.FontDescription;

import guideme.color.SymbolicColor;

public final class TextStyle {
    private Integer color;
    private Boolean dropShadow;

    public static TextStyle builder() {
        return new TextStyle();
    }

    public TextStyle color(SymbolicColor color) {
        this.color = color.argb;
        return this;
    }

    public TextStyle font(FontDescription font) {
        return this;
    }

    public TextStyle dropShadow(boolean dropShadow) {
        this.dropShadow = dropShadow;
        return this;
    }

    public TextStyle build() {
        return this;
    }

    public ResolvedTextStyle mergeWith(ResolvedTextStyle base) {
        return new ResolvedTextStyle(color != null ? color : base.color(),
                dropShadow != null ? dropShadow : base.dropShadow());
    }
}
