import type { ComfyAsset, ComfyWorkflow } from "./contracts";

const WORKFLOW_VERSION = "ltx2.5-timeshift-v1";
const PROMPT_NODE = "398:376";
const DURATION_NODE = "398:362";
const ASSET_NODE = "395";
const DURATION_SECONDS = 20;

const BASE_WORKFLOW: ComfyWorkflow = {
  [PROMPT_NODE]: {
    class_type: "Reroute",
    inputs: {
      value: "",
    },
  },
  [DURATION_NODE]: {
    class_type: "Reroute",
    inputs: {
      value: DURATION_SECONDS,
    },
  },
  [ASSET_NODE]: {
    class_type: "LoadImage",
    inputs: {
      image: {
        __type: "core/ASSET",
        info: { id: "" },
      },
    },
  },
};

export function timeShiftWorkflowVersion(): string {
  return WORKFLOW_VERSION;
}

function cloneWorkflow(): ComfyWorkflow {
  return structuredClone(BASE_WORKFLOW);
}

export function buildTimeShiftWorkflow(asset: ComfyAsset, prompt: string): ComfyWorkflow {
  const workflow = cloneWorkflow();
  const promptNode = workflow[PROMPT_NODE] as { inputs: { value: string } };
  const durationNode = workflow[DURATION_NODE] as { inputs: { value: number } };
  const assetNode = workflow[ASSET_NODE] as {
    inputs: { image: { __type: "core/ASSET"; info: { id: string } } };
  };

  promptNode.inputs.value = prompt;
  durationNode.inputs.value = DURATION_SECONDS;
  assetNode.inputs.image = { __type: "core/ASSET", info: { id: asset.id } };

  return workflow;
}
