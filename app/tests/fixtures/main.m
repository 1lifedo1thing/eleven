#import <Foundation/Foundation.h>
#import <Metal/Metal.h>

@interface BlurFilter : NSObject
@property(nonatomic, strong) id<MTLComputePipelineState> blur;
@property(nonatomic, strong) id<MTLComputePipelineState> tone;
- (instancetype)initWithDevice:(id<MTLDevice>)device;
- (void)encodeToCommandBuffer:(id<MTLCommandBuffer>)buffer source:(id<MTLTexture>)src destination:(id<MTLTexture>)dst;
@end

@implementation BlurFilter
- (instancetype)initWithDevice:(id<MTLDevice>)device {
  self = [super init];
  NSError *error = nil;
  NSString *path = [[[NSProcessInfo processInfo].arguments[0] stringByDeletingLastPathComponent] stringByAppendingPathComponent:@"../Resources/default.metallib"];
  id<MTLLibrary> library = [device newLibraryWithURL:[NSURL fileURLWithPath:path] error:&error];
  id<MTLFunction> blur = [library newFunctionWithName:@"gaussian_blur_h"];
  id<MTLFunction> tone = [library newFunctionWithName:@"tone_map"];
  _blur = [device newComputePipelineStateWithFunction:blur error:&error];
  _tone = [device newComputePipelineStateWithFunction:tone error:&error];
  return self;
}

- (void)encodeToCommandBuffer:(id<MTLCommandBuffer>)buffer source:(id<MTLTexture>)src destination:(id<MTLTexture>)dst {
  static const float weights[9] = {0.05f, 0.09f, 0.12f, 0.15f, 0.18f, 0.15f, 0.12f, 0.09f, 0.05f};
  MTLSize grid = MTLSizeMake(src.width, src.height, 1);
  MTLSize group = MTLSizeMake(16, 16, 1);
  id<MTLComputeCommandEncoder> encoder = [buffer computeCommandEncoder];
  [encoder setComputePipelineState:self.blur];
  [encoder setTexture:src atIndex:0];
  [encoder setTexture:dst atIndex:1];
  [encoder setBytes:weights length:sizeof(weights) atIndex:0];
  [encoder dispatchThreads:grid threadsPerThreadgroup:group];
  [encoder setComputePipelineState:self.tone];
  [encoder setTexture:dst atIndex:0];
  [encoder dispatchThreads:grid threadsPerThreadgroup:group];
  [encoder endEncoding];
}
@end

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    id<MTLDevice> device = MTLCreateSystemDefaultDevice();
    id<MTLCommandQueue> queue = [device newCommandQueue];
    MTLTextureDescriptor *desc = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA16Float width:3840 height:2160 mipmapped:NO];
    desc.usage = MTLTextureUsageShaderRead | MTLTextureUsageShaderWrite;
    id<MTLTexture> src = [device newTextureWithDescriptor:desc];
    id<MTLTexture> dst = [device newTextureWithDescriptor:desc];
    BlurFilter *filter = [[BlurFilter alloc] initWithDevice:device];
    int frames = argc > 1 ? atoi(argv[1]) : 60;
    BOOL pipelined = argc > 2 && strcmp(argv[2], "pipelined") == 0;
    id<MTLCommandBuffer> last = nil;
    for (int frame = 0; frame < frames; frame++) {
      id<MTLCommandBuffer> buffer = [queue commandBuffer];
      [filter encodeToCommandBuffer:buffer source:src destination:dst];
      [buffer commit];
      if (!pipelined) [buffer waitUntilCompleted];
      last = buffer;
    }
    [last waitUntilCompleted];
    NSLog(@"filtered %d frames", frames);
  }
  return 0;
}
