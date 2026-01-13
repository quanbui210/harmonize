"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface LabelWizardStepsProps {
  currentStep: 1 | 2;
  onStepClick?: (step: 1 | 2) => void;
}

export function LabelWizardSteps({ currentStep, onStepClick }: LabelWizardStepsProps) {
  const steps = [
    { number: 1, title: "Upload & Product Info", description: "Upload label image, fill product details" },
    { number: 2, title: "Compliance & Result", description: "View analysis and print label" },
  ] as const;

  return (
    <div className="flex items-center justify-between mb-6">
      {steps.map((step, idx) => {
        const stepNum = step.number as 1 | 2;
        const isCompleted = currentStep > stepNum;
        const isCurrent = currentStep === stepNum;
        const isClickable = onStepClick && (isCompleted || isCurrent);

        return (
          <div key={stepNum} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(stepNum)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  isCompleted && "bg-green-500 border-green-500 text-white",
                  isCurrent && "bg-blue-500 border-blue-500 text-white",
                  !isCompleted && !isCurrent && "bg-gray-100 border-gray-300 text-gray-400",
                  isClickable && "cursor-pointer hover:opacity-80",
                  !isClickable && "cursor-not-allowed"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </button>
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    "text-sm font-medium",
                    isCurrent && "text-blue-600",
                    isCompleted && "text-green-600",
                    !isCurrent && !isCompleted && "text-gray-400"
                  )}
                >
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
              </div>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 mx-4 -mt-5",
                  currentStep > stepNum ? "bg-green-500" : "bg-gray-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

