import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Question {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
}

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  selectedAnswer: string | null;
  onAnswerSelect: (answer: string) => void;
  disabled?: boolean;
}

export function QuestionCard({ 
  question, 
  questionNumber, 
  selectedAnswer, 
  onAnswerSelect,
  disabled = false 
}: QuestionCardProps) {
  const options = [
    { value: 'A', text: question.option_a },
    { value: 'B', text: question.option_b },
    { value: 'C', text: question.option_c },
    { value: 'D', text: question.option_d },
  ];

  return (
    <Card className="bg-muted rounded-lg">
      <CardContent className="p-6">
        <div className="flex items-start space-x-3 mb-6">
          <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-medium flex-shrink-0">
            {questionNumber}
          </span>
          <h3 className="text-lg font-medium text-foreground leading-relaxed">
            {question.question}
          </h3>
        </div>

        <div className="ml-11">
          <RadioGroup
            value={selectedAnswer || ''}
            onValueChange={onAnswerSelect}
            disabled={disabled}
          >
            <div className="space-y-3">
              {options.map((option) => (
                <div key={option.value} className="exam-option">
                  <RadioGroupItem
                    value={option.value}
                    id={`q${questionNumber}_${option.value}`}
                    className="sr-only"
                  />
                  <Label
                    htmlFor={`q${questionNumber}_${option.value}`}
                    className="exam-option-content flex items-start cursor-pointer w-full"
                  >
                    <div className="exam-option-indicator"></div>
                    <div className="flex-1">
                      <span className="font-medium text-primary mr-2">{option.value}.</span>
                      <span className="text-foreground">{option.text}</span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      </CardContent>
    </Card>
  );
}
