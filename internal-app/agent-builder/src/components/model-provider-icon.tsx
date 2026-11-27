"use client";

/* eslint-disable @next/next/no-img-element */
import type { StaticImageData } from "next/image";
import alibabacloudIcon from "@lobehub/icons-static-svg/icons/alibabacloud-color.svg";
import anthropicIcon from "@lobehub/icons-static-svg/icons/anthropic.svg";
import azureIcon from "@lobehub/icons-static-svg/icons/azure-color.svg";
import bedrockIcon from "@lobehub/icons-static-svg/icons/bedrock-color.svg";
import claudeIcon from "@lobehub/icons-static-svg/icons/claude-color.svg";
import deepseekIcon from "@lobehub/icons-static-svg/icons/deepseek-color.svg";
import doubaoIcon from "@lobehub/icons-static-svg/icons/doubao-color.svg";
import fireworksIcon from "@lobehub/icons-static-svg/icons/fireworks-color.svg";
import geminiIcon from "@lobehub/icons-static-svg/icons/gemini-color.svg";
import groqIcon from "@lobehub/icons-static-svg/icons/groq.svg";
import huggingfaceIcon from "@lobehub/icons-static-svg/icons/huggingface-color.svg";
import metaIcon from "@lobehub/icons-static-svg/icons/meta-color.svg";
import minimaxIcon from "@lobehub/icons-static-svg/icons/minimax-color.svg";
import mistralIcon from "@lobehub/icons-static-svg/icons/mistral-color.svg";
import moonshotIcon from "@lobehub/icons-static-svg/icons/moonshot.svg";
import ollamaIcon from "@lobehub/icons-static-svg/icons/ollama.svg";
import openaiIcon from "@lobehub/icons-static-svg/icons/openai.svg";
import openrouterIcon from "@lobehub/icons-static-svg/icons/openrouter.svg";
import perplexityIcon from "@lobehub/icons-static-svg/icons/perplexity-color.svg";
import qwenIcon from "@lobehub/icons-static-svg/icons/qwen-color.svg";
import siliconcloudIcon from "@lobehub/icons-static-svg/icons/siliconcloud-color.svg";
import tencentcloudIcon from "@lobehub/icons-static-svg/icons/tencentcloud-color.svg";
import togetherIcon from "@lobehub/icons-static-svg/icons/together-color.svg";
import vertexaiIcon from "@lobehub/icons-static-svg/icons/vertexai-color.svg";
import vllmIcon from "@lobehub/icons-static-svg/icons/vllm-color.svg";
import volcengineIcon from "@lobehub/icons-static-svg/icons/volcengine-color.svg";
import xaiIcon from "@lobehub/icons-static-svg/icons/xai.svg";
import zhipuIcon from "@lobehub/icons-static-svg/icons/zhipu-color.svg";
import type { ModelProviderIconId } from "@/lib/types";

type SvgAsset = StaticImageData | string;

interface IconAssetMeta {
  asset: SvgAsset;
  monochrome: boolean;
}

const PROVIDER_ICON_ASSETS: Record<ModelProviderIconId, IconAssetMeta> = {
  openai: { asset: openaiIcon, monochrome: true },
  anthropic: { asset: anthropicIcon, monochrome: true },
  claude: { asset: claudeIcon, monochrome: false },
  deepseek: { asset: deepseekIcon, monochrome: false },
  gemini: { asset: geminiIcon, monochrome: false },
  qwen: { asset: qwenIcon, monochrome: false },
  zhipu: { asset: zhipuIcon, monochrome: false },
  doubao: { asset: doubaoIcon, monochrome: false },
  moonshot: { asset: moonshotIcon, monochrome: true },
  minimax: { asset: minimaxIcon, monochrome: false },
  openrouter: { asset: openrouterIcon, monochrome: true },
  azure: { asset: azureIcon, monochrome: false },
  bedrock: { asset: bedrockIcon, monochrome: false },
  vertexai: { asset: vertexaiIcon, monochrome: false },
  ollama: { asset: ollamaIcon, monochrome: true },
  vllm: { asset: vllmIcon, monochrome: false },
  mistral: { asset: mistralIcon, monochrome: false },
  meta: { asset: metaIcon, monochrome: false },
  xai: { asset: xaiIcon, monochrome: true },
  groq: { asset: groqIcon, monochrome: true },
  siliconcloud: { asset: siliconcloudIcon, monochrome: false },
  volcengine: { asset: volcengineIcon, monochrome: false },
  alibabacloud: { asset: alibabacloudIcon, monochrome: false },
  tencentcloud: { asset: tencentcloudIcon, monochrome: false },
  together: { asset: togetherIcon, monochrome: false },
  fireworks: { asset: fireworksIcon, monochrome: false },
  perplexity: { asset: perplexityIcon, monochrome: false },
  huggingface: { asset: huggingfaceIcon, monochrome: false },
};

function resolveAssetSrc(asset: SvgAsset): string {
  return typeof asset === "string" ? asset : asset.src;
}

export function ModelProviderIcon({
  icon,
  size = 18,
  framed = false,
  frameSize,
}: {
  icon: ModelProviderIconId;
  size?: number;
  framed?: boolean;
  frameSize?: number;
}) {
  const meta = PROVIDER_ICON_ASSETS[icon] ?? PROVIDER_ICON_ASSETS.openai;
  const src = resolveAssetSrc(meta.asset);

  const glyph = meta.monochrome ? (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        inlineSize: size,
        blockSize: size,
        flexShrink: 0,
        backgroundColor: "currentColor",
        maskImage: `url("${src}")`,
        WebkitMaskImage: `url("${src}")`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain",
      }}
    />
  ) : (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{
        display: "block",
        inlineSize: size,
        blockSize: size,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );

  if (!framed) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          inlineSize: size,
          blockSize: size,
          flexShrink: 0,
        }}
      >
        {glyph}
      </span>
    );
  }

  const boxSize = frameSize ?? size + 16;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        inlineSize: boxSize,
        blockSize: boxSize,
        borderRadius: "var(--radius-element, 8px)",
        backgroundColor:
          "color-mix(in srgb, var(--color-text-primary, currentColor) 6%, transparent)",
        flexShrink: 0,
      }}
    >
      {glyph}
    </span>
  );
}
