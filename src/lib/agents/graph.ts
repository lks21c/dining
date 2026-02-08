import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./state";
import { dispatcher } from "./nodes/dispatcher";
import { naverPlaceAgent } from "./nodes/naver-place";
import { diningcodeAgent } from "./nodes/diningcode";
import { suyoFoodTalkAgent } from "./nodes/suyo-food-talk";
import { hongseokcheonAgent } from "./nodes/hongseokcheon";
import { youtubeAgent } from "./nodes/youtube";
import { instagramAgent } from "./nodes/instagram";
import { parkingAgent } from "./nodes/parking";
import { aggregator } from "./nodes/aggregator";

const builder = new StateGraph(AgentStateAnnotation)
  .addNode("dispatcher", dispatcher)
  .addNode("naverPlace", naverPlaceAgent)
  .addNode("diningcode", diningcodeAgent)
  .addNode("suyoFoodTalk", suyoFoodTalkAgent)
  .addNode("hongseokcheon", hongseokcheonAgent)
  .addNode("youtube", youtubeAgent)
  .addNode("instagram", instagramAgent)
  .addNode("parking", parkingAgent)
  .addNode("aggregator", aggregator, { defer: true })
  // Entry
  .addEdge(START, "dispatcher")
  // Fan-out: dispatcher → 7 agents in parallel
  .addEdge("dispatcher", "naverPlace")
  .addEdge("dispatcher", "diningcode")
  .addEdge("dispatcher", "suyoFoodTalk")
  .addEdge("dispatcher", "hongseokcheon")
  .addEdge("dispatcher", "youtube")
  .addEdge("dispatcher", "instagram")
  .addEdge("dispatcher", "parking")
  // Fan-in: 7 agents → aggregator (deferred, waits for all)
  .addEdge("naverPlace", "aggregator")
  .addEdge("diningcode", "aggregator")
  .addEdge("suyoFoodTalk", "aggregator")
  .addEdge("hongseokcheon", "aggregator")
  .addEdge("youtube", "aggregator")
  .addEdge("instagram", "aggregator")
  .addEdge("parking", "aggregator")
  // Exit
  .addEdge("aggregator", END);

export const searchGraph = builder.compile();
