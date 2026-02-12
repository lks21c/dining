import { Annotation } from "@langchain/langgraph";
import type { Bounds, SearchResult } from "@/types/place";

export interface RawCrawledPlace {
  name: string;
  category?: string;
  description?: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  reviewCount?: number;
  source: string;
  sourceUrl?: string;
  snippet?: string;
  tags?: string;  // 쉼표 구분: "청국장, 주물럭"
  metadata?: string;  // JSON: {"score": 87.5}
}

export const AgentStateAnnotation = Annotation.Root({
  query: Annotation<string>,
  searchTerms: Annotation<string>,
  location: Annotation<{ lat: number; lng: number; name: string } | null>,
  bounds: Annotation<Bounds | null>,
  crawledPlaces: Annotation<RawCrawledPlace[]>({
    default: () => [],
    reducer: (acc, val) => acc.concat(val),
  }),
  agentErrors: Annotation<string[]>({
    default: () => [],
    reducer: (acc, val) => acc.concat(val),
  }),
  finalResult: Annotation<SearchResult | null>,
});

export type AgentState = typeof AgentStateAnnotation.State;
