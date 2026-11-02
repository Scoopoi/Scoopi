package guideme.document;

public record LytRect(int x, int y, int width, int height) {
    public static LytRect empty() {
        return new LytRect(0, 0, 0, 0);
    }

    public int right() {
        return x + width;
    }

    public int bottom() {
        return y + height;
    }
}
