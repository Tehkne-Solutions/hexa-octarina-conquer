import { useState, type CSSProperties } from "react";

import {
  campaignMissionGlyph,
  campaignThemeStyle,
  type CampaignNarrativeTheme,
} from "./campaign-narrative";

interface CampaignNarrativeArtProps {
  theme: CampaignNarrativeTheme;
  missionOrder: number;
  missionTitle: string;
  variant: "chapter" | "selected" | "briefing";
  decorative?: boolean;
  loading?: "eager" | "lazy";
}

export function CampaignNarrativeArt({
  theme,
  missionOrder,
  missionTitle,
  variant,
  decorative = false,
  loading = "lazy",
}: CampaignNarrativeArtProps) {
  const [failed, setFailed] = useState(false);
  const glyph = campaignMissionGlyph(theme.chapterId, missionOrder);
  const style = campaignThemeStyle(theme) as CSSProperties;

  return (
    <figure
      className={`campaign-narrative-art narrative-${variant} theme-${theme.id} ${failed ? "asset-fallback" : ""}`}
      style={style}
      aria-hidden={decorative || undefined}
    >
      <div className="campaign-narrative-fallback" aria-hidden="true">
        <span className="narrative-orb" />
        <span className="narrative-ridge ridge-far" />
        <span className="narrative-ridge ridge-near" />
        <span className="narrative-route" />
      </div>
      {!failed ? (
        <img
          src={theme.keyArt}
          alt={decorative ? "" : theme.alt}
          loading={loading}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : null}
      <span className="narrative-vignette" aria-hidden="true" />
      <span className="narrative-grain" aria-hidden="true" />
      <span className="narrative-mission-seal" aria-hidden="true">{glyph}</span>
      <figcaption>
        <small>{theme.shortRegion}</small>
        <strong>{missionTitle}</strong>
        <span>{theme.atmosphere}</span>
      </figcaption>
    </figure>
  );
}
