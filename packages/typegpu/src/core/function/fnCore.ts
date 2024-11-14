import { MissingLinksError } from '../../errors';
import { code } from '../../tgpuCode';
import { identifier } from '../../tgpuIdentifier';
import type { ResolutionCtx } from '../../types';
import {
  type ExternalMap,
  applyExternals,
  replaceExternalsInWgsl,
} from './externals';
import type { Implementation, TranspilationResult } from './fnTypes';

export interface TgpuFnShellBase<Args extends unknown[], Return> {
  readonly argTypes: Args;
  readonly returnType: Return | undefined;
}

interface FnCore {
  label: string | undefined;
  applyExternals(newExternals: ExternalMap): void;
  setAst(ast: TranspilationResult): void;
  resolve(ctx: ResolutionCtx, fnAttribute?: string): string;
}

export function createFnCore(
  shell: TgpuFnShellBase<unknown[], unknown>,
  implementation: Implementation<unknown[], unknown>,
): FnCore {
  const externalMap: ExternalMap = {};
  let prebuiltAst: TranspilationResult | null = null;

  return {
    label: undefined as string | undefined,

    applyExternals(newExternals: ExternalMap): void {
      applyExternals(externalMap, newExternals);
    },

    setAst(ast: TranspilationResult): void {
      prebuiltAst = ast;
    },

    resolve(ctx: ResolutionCtx, fnAttribute = ''): string {
      const ident = identifier().$name(this.label);

      if (typeof implementation === 'string') {
        const replacedImpl = replaceExternalsInWgsl(
          ctx,
          externalMap,
          implementation.trim(),
        );

        ctx.addDeclaration(code`${fnAttribute}fn ${ident}${replacedImpl}`);
      } else {
        const ast = prebuiltAst ?? ctx.transpileFn(String(implementation));

        // Verifying all required externals are present.
        const missingExternals = ast.externalNames.filter(
          (name) => !(name in externalMap),
        );

        if (missingExternals.length > 0) {
          throw new MissingLinksError(this.label, missingExternals);
        }

        const { head, body } = ctx.fnToWgsl(
          shell,
          ast.argNames,
          ast.body,
          externalMap,
        );
        ctx.addDeclaration(code`${fnAttribute}fn ${ident}${head}${body}`);
      }

      return ctx.resolve(ident);
    },
  };
}
