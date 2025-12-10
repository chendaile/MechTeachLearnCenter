import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Data structure for the bounding box [ymin, xmin, ymax, xmax]
// We assume a 0-1000 scale which is standard for many Gemini vision tasks.
export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

// Existing UI Types
export interface FeedbackItem {
  id: string; // Unique ID for keying
  label: string; // Short title of the issue (e.g., "Calculation Error")
  details: string; // Detailed explanation
  box_2d: number[]; // Array of 4 numbers [ymin, xmin, ymax, xmax] on 0-1000 scale
  type: 'error' | 'suggestion' | 'praise';
  imageIndex: number; // 0-based index of the image this annotation belongs to
}

export interface GradingResponse {
  summary: string;
  annotations: FeedbackItem[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text?: string;
  images?: string[]; // Array of Base64 data URIs
  gradingResult?: GradingResponse;
  isLoading?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}


// --- New Raw API Types based on User Schema ---

export interface PositionRect {
  x: number; // percent 0-1
  y: number; // percent 0-1
  width: number; // percent 0-1
  height: number; // percent 0-1
}

export interface ProcessStep {
  text: string;
  formula: string;
  picture_index: string | number;
  position_of_whole_step: PositionRect;
  correction_of_whole_step?: string;
}

export interface ResultItem {
  text: string;
  picture_index: string | number;
  position_of_result: PositionRect;
  correction_of_result?: string;
}

export interface StudentAnswer {
  process: {
    steps: ProcessStep[];
  };
  result: ResultItem;
}

export interface ReferenceStep {
  text: string;
  formula: string;
  picture_index: string | number;
  position_of_whole_step?: PositionRect;
}

export interface ReferenceAnswer {
  process: {
    steps: ReferenceStep[];
  };
  result: {
    text: string;
    picture_index: string | number;
    position_of_result?: PositionRect;
  };
}

export interface QuestionInfo {
  text: string;
  picture_index: string | number;
  position_of_whole_step: PositionRect;
}

export interface RawAnalysisResult {
  "Link-picture": string[];
  "Question": QuestionInfo;
  "Answer": {
    student: StudentAnswer[]; // Changed to Array to support multiple answers/pages
    reference: ReferenceAnswer;
  };
}