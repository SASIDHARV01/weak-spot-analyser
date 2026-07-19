"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  
  useEffect(() => {
    async function fetchQuiz() {
      // 1. Fetch Quiz Header
      const { data: quizData } = await supabase.from("quizzes").select("*").eq("id", params.id).single();
      setQuiz(quizData);

      // 2. Fetch Questions
      const { data: questionData } = await supabase.from("quiz_questions").select("*").eq("quiz_id", params.id);
      setQuestions(questionData || []);
    }
    fetchQuiz();
  }, [params.id]);

  const handleOptionSelect = (option: string) => {
    if (selectedOption) return; // Prevent double clicking
    setSelectedOption(option);
    const correct = option === questions[currentIndex].correct_option;
    setIsCorrect(correct);
    if (correct) setScore(s => s + 1);
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsCorrect(null);
    } else {
      setFinished(true);
    }
  };

  if (!quiz || questions.length === 0) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto w-10 h-10" /></div>;

  if (finished) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-lg">
        <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>
        <p className="text-xl mb-8">You scored {score} out of {questions.length}</p>
        <button onClick={() => router.push("/")} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold">Back to Dashboard</button>
      </div>
    </div>
  );

  const currentQ = questions[currentIndex];

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white p-8 sm:p-12 rounded-3xl shadow-sm border border-slate-100">
        <p className="text-indigo-600 font-bold mb-4">Question {currentIndex + 1} of {questions.length}</p>
        <h2 className="text-2xl font-bold text-slate-900 mb-8">{currentQ.question_text}</h2>
        
        <div className="space-y-4">
          {currentQ.options.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => handleOptionSelect(opt)}
              className={`w-full p-4 text-left rounded-xl border transition-all ${
                selectedOption === opt 
                  ? (isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500')
                  : 'hover:border-indigo-300 border-slate-200'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {selectedOption && (
          <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              {isCorrect ? <CheckCircle2 className="text-green-500"/> : <XCircle className="text-red-500"/>}
              {isCorrect ? "Correct!" : "Incorrect"}
            </h4>
            <p className="text-slate-700 text-sm">{currentQ.explanation}</p>
            <button onClick={nextQuestion} className="mt-6 flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">
              Next Question <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}