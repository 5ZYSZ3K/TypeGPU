import type { Unwrap } from 'typed-binary';
import { SimpleTgpuData, TgpuArrayImpl } from './data';
import { inGPUMode } from './gpuMode';
import {
  type Storage,
  type TgpuBuffer,
  type Uniform,
  type Vertex,
  isUsableAsStorage,
  isUsableAsUniform,
  isUsableAsVertex,
} from './tgpuBuffer';
import { identifier } from './tgpuIdentifier';
import type {
  AnyTgpuData,
  BufferUsage,
  ResolutionCtx,
  TgpuBindable,
} from './types';

// ----------
// Public API
// ----------
export interface TgpuBufferUniform<TData extends AnyTgpuData>
  extends TgpuBindable<TData, 'uniform'> {
  value: Unwrap<TData>;
}

export interface TgpuBufferReadonly<TData extends AnyTgpuData>
  extends TgpuBindable<TData, 'readonly'> {
  value: Unwrap<TData>;
}

export interface TgpuBufferMutable<TData extends AnyTgpuData>
  extends TgpuBindable<TData, 'mutable'> {
  value: Unwrap<TData>;
}

export interface TgpuBufferVertex<TData extends AnyTgpuData>
  extends TgpuBindable<TData, 'vertex'> {
  vertexLayout: Omit<GPUVertexBufferLayout, 'attributes'>;
}

export interface TgpuBufferUsage<
  TData extends AnyTgpuData,
  TUsage extends BufferUsage = BufferUsage,
> extends TgpuBindable<TData, TUsage> {
  value: Unwrap<TData>;
}

// --------------
// Implementation
// --------------

class TgpuBufferUsageImpl<TData extends AnyTgpuData, TUsage extends BufferUsage>
  implements TgpuBufferUsage<TData, TUsage>
{
  constructor(
    public readonly buffer: TgpuBuffer<TData>,
    public readonly usage: TUsage,
  ) {}

  get label() {
    return this.buffer.label;
  }

  get allocatable() {
    return this.buffer;
  }

  $name(label: string) {
    this.buffer.$name(label);
  }

  resolve(ctx: ResolutionCtx): string {
    const ident = identifier().$name(this.label);
    ctx.addBinding(this, ident);
    return ctx.resolve(ident);
  }

  toString(): string {
    return `${this.usage}:${this.label ?? '<unnamed>'}`;
  }

  get value(): Unwrap<TData> {
    if (!inGPUMode()) {
      throw new Error(`Cannot access buffer's value directly in JS.`);
    }
    return this as Unwrap<TData>;
  }
}

class TgpuBufferVertexImpl<TData extends AnyTgpuData>
  implements TgpuBufferVertex<TData>
{
  readonly usage = 'vertex';
  public readonly vertexLayout: Omit<GPUVertexBufferLayout, 'attributes'>;

  constructor(
    public readonly allocatable: TgpuBuffer<TData>,
    stepMode: 'vertex' | 'instance',
  ) {
    if (allocatable.dataType instanceof SimpleTgpuData) {
      this.vertexLayout = {
        arrayStride: allocatable.dataType.size,
        stepMode,
      };
    } else if (allocatable.dataType instanceof TgpuArrayImpl) {
      this.vertexLayout = {
        arrayStride: allocatable.dataType.elementType.size,
        stepMode,
      };
    } else {
      throw new Error(
        'Only simple or array data types can be used as vertex buffers',
      );
    }
  }

  get label() {
    return this.allocatable.label;
  }

  resolve(ctx: ResolutionCtx): string {
    const ident = identifier().$name(this.label);
    ctx.addBinding(this, ident);
    return ctx.resolve(ident);
  }

  toString(): string {
    return `vertex:${this.label ?? '<unnamed>'}`;
  }
}

const mutableUsageMap = new WeakMap<
  TgpuBuffer<AnyTgpuData>,
  TgpuBufferUsageImpl<AnyTgpuData, 'mutable'>
>();

export function asMutable<TData extends AnyTgpuData>(
  buffer: TgpuBuffer<TData> & Storage,
): TgpuBufferMutable<TData> {
  if (!isUsableAsStorage(buffer)) {
    throw new Error(
      `Cannot pass ${buffer} to asMutable, as it is not allowed to be used as storage. To allow it, call .$usage(tgpu.Storage) when creating the buffer.`,
    );
  }

  let usage = mutableUsageMap.get(buffer);
  if (!usage) {
    usage = new TgpuBufferUsageImpl(buffer, 'mutable');
    mutableUsageMap.set(buffer, usage);
  }
  return usage as unknown as TgpuBufferMutable<TData>;
}

const readonlyUsageMap = new WeakMap<
  TgpuBuffer<AnyTgpuData>,
  TgpuBufferUsageImpl<AnyTgpuData, 'readonly'>
>();

export function asReadonly<TData extends AnyTgpuData>(
  buffer: TgpuBuffer<TData> & Storage,
): TgpuBufferReadonly<TData> {
  if (!isUsableAsStorage(buffer)) {
    throw new Error(
      `Cannot pass ${buffer} to asReadonly, as it is not allowed to be used as storage. To allow it, call .$usage(tgpu.Storage) when creating the buffer.`,
    );
  }

  let usage = readonlyUsageMap.get(buffer);
  if (!usage) {
    usage = new TgpuBufferUsageImpl(buffer, 'readonly');
    readonlyUsageMap.set(buffer, usage);
  }
  return usage as unknown as TgpuBufferReadonly<TData>;
}

const uniformUsageMap = new WeakMap<
  TgpuBuffer<AnyTgpuData>,
  TgpuBufferUsageImpl<AnyTgpuData, 'uniform'>
>();

export function asUniform<TData extends AnyTgpuData>(
  buffer: TgpuBuffer<TData> & Uniform,
): TgpuBufferUniform<TData> {
  if (!isUsableAsUniform(buffer)) {
    throw new Error(
      `Cannot pass ${buffer} to asUniform, as it is not allowed to be used as a uniform. To allow it, call .$usage(tgpu.Uniform) when creating the buffer.`,
    );
  }

  let usage = uniformUsageMap.get(buffer);
  if (!usage) {
    usage = new TgpuBufferUsageImpl(buffer, 'uniform');
    uniformUsageMap.set(buffer, usage);
  }
  return usage as unknown as TgpuBufferUniform<TData>;
}

const vertexUsageMap = new WeakMap<
  TgpuBuffer<AnyTgpuData>,
  {
    vertex: TgpuBufferVertexImpl<AnyTgpuData>;
    instance: TgpuBufferVertexImpl<AnyTgpuData>;
  }
>();

export function asVertex<TData extends AnyTgpuData>(
  buffer: TgpuBuffer<TData> & Vertex,
  stepMode: 'vertex' | 'instance',
): TgpuBufferVertex<TData> {
  if (!isUsableAsVertex(buffer)) {
    throw new Error(
      `Cannot pass ${buffer} to asVertex, as it is not allowed to be used as a vertex buffer. To allow it, call .$usage(tgpu.Vertex) when creating the buffer.`,
    );
  }

  let usage = vertexUsageMap.get(buffer);
  if (!usage) {
    usage = {
      vertex: new TgpuBufferVertexImpl(buffer, 'vertex'),
      instance: new TgpuBufferVertexImpl(buffer, 'instance'),
    };
    vertexUsageMap.set(buffer, usage);
  }
  return usage[stepMode] as unknown as TgpuBufferVertex<TData>;
}