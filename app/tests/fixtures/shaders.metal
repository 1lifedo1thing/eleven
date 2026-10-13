#include <metal_stdlib>
using namespace metal;

kernel void gaussian_blur_h(texture2d<half, access::read> src [[texture(0)]],
                            texture2d<half, access::write> dst [[texture(1)]],
                            constant float *weights [[buffer(0)]],
                            uint2 gid [[thread_position_in_grid]]) {
  half4 acc = 0;
  for (int i = -4; i <= 4; i++) acc += src.read(uint2(int(gid.x) + i, gid.y)) * half(weights[i + 4]);
  dst.write(acc, gid);
}

kernel void tone_map(texture2d<half, access::read_write> img [[texture(0)]], uint2 gid [[thread_position_in_grid]]) {
  half4 c = img.read(gid);
  img.write(c / (c + 1.0h), gid);
}
