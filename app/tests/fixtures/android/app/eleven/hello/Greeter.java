package app.eleven.hello;

public class Greeter {
    static {
        System.loadLibrary("hello");
    }

    private final String name;

    public Greeter(String name) {
        this.name = name;
    }

    public String greet() {
        return "Hello, " + name + shout(3) + checksum(name.length());
    }

    public static int shout(int times) {
        int total = 0;
        for (int i = 0; i < times; i++) total += i * 3;
        return total;
    }

    private static native int checksum(int seed);
}
