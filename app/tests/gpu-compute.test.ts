import { expect, test } from "bun:test";
import { join } from "node:path";

import { cudaKernelIr, demangle, readComputeLibraries } from "../src/gpu/compute";
import { fatEntries, signatureParams } from "../src/gpu/compute/cuda";
import { gfxOf } from "../src/gpu/compute/hip";
import { unpack } from "../src/gpu/compute/msgpack";
import { shortName } from "../src/gpu/look";

const GPU = join(import.meta.dir, "fixtures", "gpu");
const FATBIN = join(GPU, "acc.fatbin");
const BUNDLE = join(GPU, "acc.hipfb");

test("CUDA: a fatbin's PTX and cubin builds, per GPU generation", async () => {
  const entries = fatEntries(await Bun.file(FATBIN).bytes().then(Buffer.from));
  expect(entries.filter((e) => e.kind === "cubin").map((e) => e.sm).sort((a, b) => a - b)).toEqual([86, 89, 120, 121]);
  expect(entries.filter((e) => e.kind === "ptx").map((e) => e.sm).sort((a, b) => a - b)).toEqual([75, 80, 90]);
});

test("CUDA: kernels with their registers, parameter block and readable names, and PTX read only when opened", async () => {
  const [lib] = await readComputeLibraries(FATBIN);
  expect(lib?.api).toBe("cuda");
  const acc = lib?.functions.find((f) => f.symbol === "_Z7acc_f32PKfS0_Pflllllllll");
  expect(acc?.name).toBe("acc_f32(float const*, float const*, float*, long, long, long, long, long, long, long, long, long)");
  expect(acc?.stats).toContainEqual({ slot: "Registers", type: "32 per thread" });
  expect(acc?.stats).toContainEqual({ slot: "Parameter block", type: "96 bytes" });
  expect(acc?.bindings[0]).toEqual({ slot: "param 0", type: "float const*" });
  expect(acc?.ir).toBe("");
  if (!lib || !acc) throw new Error("no kernel");
  const ptx = await cudaKernelIr(FATBIN, lib.name, acc);
  expect(ptx.startsWith(".entry _Z7acc_f32PKfS0_Pflllllllll(")).toBe(true);
  expect(ptx.trimEnd().endsWith("}")).toBe(true);
});

test("HIP: kernels from an offload bundle, with registers, arguments and the GPUs it was built for", async () => {
  const [lib] = await readComputeLibraries(BUNDLE);
  expect(lib?.api).toBe("hip");
  const acc = lib?.functions.find((f) => f.name.startsWith("acc_f32("));
  expect(acc?.stats.some((s) => s.slot === "Vector registers")).toBe(true);
  expect(acc?.stats.find((s) => s.slot === "Built for")?.type).toContain("gfx1030");
  expect(acc?.bindings[0]).toEqual({ slot: "arg 0", type: "float const*, 8 bytes" });
  expect(acc?.bindings.some((b) => b.type.includes("hidden"))).toBe(false);
  expect(acc?.ir).toContain(".vgpr_count");
});

test("small pieces: signatures, GPU names, MessagePack and demangling", () => {
  expect(signatureParams("void k<float, std::pair<int, int>>(float*, std::pair<int, int>, int)")).toEqual(["float*", "std::pair<int, int>", "int"]);
  expect(signatureParams("k()")).toEqual([]);
  expect(gfxOf("hipv4-amdgcn-amd-amdhsa--gfx90a:xnack-")).toBe("gfx90a");
  expect(unpack(Buffer.from([0x82, 0xa1, 0x61, 0x01, 0xa1, 0x62, 0x92, 0xc3, 0xa0]))).toEqual({ a: 1, b: [true, ""] });
  expect(demangle(["_Z3fooi", "not_mangled"])).toEqual(["foo(int)", "not_mangled"]);
  expect(shortName("void ggml_cuda_ar_add_kernel<__half, __half>(__half*, int)")).toBe("ggml_cuda_ar_add_kernel<__half, __half>");
  expect(shortName("k<(ggml_type)2, 128>(char const*)")).toBe("k<(ggml_type)2, 128>");
});
