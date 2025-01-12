import { MissingBindGroupError } from '../../errors';
import type { TgpuNamable } from '../../namable';
import { resolve } from '../../resolutionCtx';
import type {
  TgpuBindGroup,
  TgpuBindGroupLayout,
} from '../../tgpuBindGroupLayout';
import type { TgpuSlot } from '../../types';
import type { TgpuComputeFn } from '../function/tgpuComputeFn';
import type { ExperimentalTgpuRoot } from '../root/rootTypes';

// ----------
// Public API
// ----------

export interface TgpuComputePipeline extends TgpuNamable {
  readonly resourceType: 'compute-pipeline';
  readonly label: string | undefined;

  with(
    bindGroupLayout: TgpuBindGroupLayout,
    bindGroup: TgpuBindGroup,
  ): TgpuComputePipeline;

  dispatchWorkgroups(
    x: number,
    y?: number | undefined,
    z?: number | undefined,
  ): void;
}

export interface INTERNAL_TgpuComputePipeline {
  readonly rawPipeline: GPUComputePipeline;
}

export function INTERNAL_createComputePipeline(
  branch: ExperimentalTgpuRoot,
  slotBindings: [TgpuSlot<unknown>, unknown][],
  entryFn: TgpuComputeFn,
) {
  return new TgpuComputePipelineImpl(
    new ComputePipelineCore(branch, slotBindings, entryFn),
    {},
  );
}

export function isComputePipeline(
  value: unknown,
): value is TgpuComputePipeline {
  return (value as TgpuComputePipeline)?.resourceType === 'compute-pipeline';
}

// --------------
// Implementation
// --------------

type TgpuComputePipelinePriors = {
  readonly bindGroupLayoutMap?: Map<TgpuBindGroupLayout, TgpuBindGroup>;
};

type Memo = {
  pipeline: GPUComputePipeline;
  bindGroupLayouts: TgpuBindGroupLayout[];
  catchall: [number, TgpuBindGroup] | null;
};

class TgpuComputePipelineImpl
  implements TgpuComputePipeline, INTERNAL_TgpuComputePipeline
{
  public readonly resourceType = 'compute-pipeline';

  constructor(
    private readonly _core: ComputePipelineCore,
    private readonly _priors: TgpuComputePipelinePriors,
  ) {}

  get label(): string | undefined {
    return this._core.label;
  }

  get rawPipeline(): GPUComputePipeline {
    return this._core.unwrap().pipeline;
  }

  with(
    bindGroupLayout: TgpuBindGroupLayout,
    bindGroup: TgpuBindGroup,
  ): TgpuComputePipeline {
    return new TgpuComputePipelineImpl(this._core, {
      bindGroupLayoutMap: new Map([
        ...(this._priors.bindGroupLayoutMap ?? []),
        [bindGroupLayout, bindGroup],
      ]),
    });
  }

  dispatchWorkgroups(
    x: number,
    y?: number | undefined,
    z?: number | undefined,
  ): void {
    const memo = this._core.unwrap();

    const pass = this._core.branch.commandEncoder.beginComputePass({
      label: this._core.label ?? '',
    });

    pass.setPipeline(memo.pipeline);

    memo.bindGroupLayouts.forEach((layout, idx) => {
      if (memo.catchall && idx === memo.catchall[0]) {
        // Catch-all
        pass.setBindGroup(idx, this._core.branch.unwrap(memo.catchall[1]));
      } else {
        const bindGroup = this._priors.bindGroupLayoutMap?.get(layout);
        if (bindGroup === undefined) {
          throw new MissingBindGroupError(layout.label);
        }
        pass.setBindGroup(idx, this._core.branch.unwrap(bindGroup));
      }
    });

    pass.dispatchWorkgroups(x, y, z);
    pass.end();
  }

  $name(label?: string | undefined): this {
    this._core.label = label;
    return this;
  }
}

class ComputePipelineCore {
  public label: string | undefined;
  private _memo: Memo | undefined;

  constructor(
    public readonly branch: ExperimentalTgpuRoot,
    private readonly _slotBindings: [TgpuSlot<unknown>, unknown][],
    private readonly _entryFn: TgpuComputeFn,
  ) {}

  public unwrap(): Memo {
    if (this._memo === undefined) {
      const device = this.branch.device;

      // Resolving code
      const { code, bindGroupLayouts, catchall } = resolve(
        {
          resolve: (ctx) => {
            ctx.resolve(this._entryFn, this._slotBindings);
            return '';
          },
        },
        {
          names: this.branch.nameRegistry,
          jitTranspiler: this.branch.jitTranspiler,
        },
      );

      this._memo = {
        pipeline: device.createComputePipeline({
          label: this.label ?? '<unnamed>',
          layout: device.createPipelineLayout({
            label: `${this.label ?? '<unnamed>'} - Pipeline Layout`,
            bindGroupLayouts: bindGroupLayouts.map((l) =>
              this.branch.unwrap(l),
            ),
          }),
          compute: {
            module: device.createShaderModule({
              label: `${this.label ?? '<unnamed>'} - Shader`,
              code,
            }),
          },
        }),
        bindGroupLayouts,
        catchall,
      };
    }

    return this._memo;
  }
}
