/**
 * @module typegpu/data
 */

export * from './std140';
export * from './numeric';
export {
  TgpuBaseStruct,
  TgpuStruct,
  TgpuLooseStruct,
  isStructSchema,
  struct,
  looseStruct,
  isLooseStructSchema,
} from './struct';
export {
  TgpuBaseArray,
  TgpuArray,
  TgpuLooseArray,
  isArraySchema,
  arrayOf,
  looseArrayOf,
  isLooseArraySchema,
} from './array';
export * from './vector';
export * from './matrix';
export * from './vertexFormatData';
export { atomic, isAtomicSchema, Atomic } from './atomic';
export {
  align,
  size,
  location,
  isDecorated,
  isLooseDecorated,
  isBuiltin,
  Align,
  Size,
  Location,
  Builtin,
  BaseDecorated,
  Decorated,
  LooseDecorated,
  AnyAttribute,
  IsBuiltin,
} from './attributes';

// Reexporting type-binary utility types
export type { Parsed, Unwrap } from 'typed-binary';
