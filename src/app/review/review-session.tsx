"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COUNTRY_MAP } from "@/lib/countries";

const WorldMap = dynamic(
  () => import("@/components/world-map").then((m) => m.WorldMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
    ),
  }
);

interface ReviewCard {
  userCountryId: number;
  countryId: string;
  countryName: string;
  borderCount: number;
  borders: string[];
  numericId: string;
  borderNumericIds: string[];
  intervalDays: number;
  reviewCount: number;
  correctCount: number;
  dueDate: string | null;
  lastReviewed: string | null;
}

type SessionPhase = "loading" | "guessing" | "revealed" | "summary" | "error";

interface SessionResult {
  card: ReviewCard;
  correct: boolean;
  matchedCount: number;
}

function normalizeCountryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Common abbreviations/alternate names
const ALIASES: Record<string, string[]> = {
  "Democratic Republic of the Congo": ["drc", "congo dr", "democratic republic congo"],
  "Republic of the Congo": ["congo", "congo republic", "republic congo"],
  "Ivory Coast": ["cote divoire", "cote d ivoire"],
  "Eswatini": ["swaziland"],
  "North Macedonia": ["macedonia"],
  "Bosnia and Herzegovina": ["bosnia", "bosnia herzegovina"],
  "United Arab Emirates": ["uae"],
  "United States": ["us", "usa", "united states of america", "america"],
  "United Kingdom": ["uk", "great britain", "britain"],
  "DR Congo": ["drc", "congo dr", "democratic republic congo", "democratic republic of the congo"],
  "South Korea": ["korea south", "republic of korea"],
  "North Korea": ["korea north", "democratic peoples republic of korea"],
  "Timor-Leste": ["east timor", "timor leste"],
  "Papua New Guinea": ["png"],
  "Central African Republic": ["car", "central africa"],
  "Saudi Arabia": ["ksa"],
  "Vatican City": ["vatican", "holy see"],
  "San Marino": [],
  "Palestine": ["west bank", "gaza", "palestinian territories"],
};

function matchGuess(
  guess: string,
  borderIds: string[]
): string | null {
  const normalizedGuess = normalizeCountryName(guess);
  if (!normalizedGuess) return null;

  for (const borderId of borderIds) {
    const country = COUNTRY_MAP.get(borderId);
    const borderName = country?.name ?? borderId;

    if (normalizeCountryName(borderName) === normalizedGuess) return borderId;

    // Check aliases
    const aliases = ALIASES[borderName] ?? [];
    for (const alias of aliases) {
      if (normalizeCountryName(alias) === normalizedGuess) return borderId;
    }
  }
  return null;
}

export function ReviewSession({ mode }: { mode?: "due" | "new" }) {
  const [phase, setPhase] = useState<SessionPhase>("loading");
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [showMap, setShowMap] = useState(false);

  // Re-review state
  const [isReReview, setIsReReview] = useState(false);
  const [reReviewCards, setReReviewCards] = useState<ReviewCard[]>([]);
  const [reReviewIndex, setReReviewIndex] = useState(0);

  const currentCard = isReReview
    ? reReviewCards[reReviewIndex]
    : cards[currentIndex];

  // Load review cards
  useEffect(() => {
    async function loadCards() {
      try {
        const params = new URLSearchParams();
        if (mode) params.set("mode", mode);
        const url = `/api/review/cards${params.size ? `?${params}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load cards");
        const data = await res.json();
        if (data.cards.length === 0) {
          setPhase("summary");
        } else {
          setCards(data.cards);
          setPhase("guessing");
        }
      } catch {
        setErrorMessage("Failed to load review cards.");
        setPhase("error");
      }
    }
    loadCards();
  }, [mode]);

  // Reset guesses when card changes
  useEffect(() => {
    if (currentCard) {
      setGuesses(Array(currentCard.borderCount).fill(""));
    }
  }, [currentCard?.countryId, isReReview ? reReviewIndex : currentIndex]);

  // Compute matched guesses for revealed phase
  const computeMatches = useCallback(
    (card: ReviewCard, guessArr: string[]) => {
      const remainingBorders = [...card.borders];
      const matched: (string | null)[] = guessArr.map((g) => {
        const matchId = matchGuess(g, remainingBorders);
        if (matchId) {
          const idx = remainingBorders.indexOf(matchId);
          if (idx !== -1) remainingBorders.splice(idx, 1);
          return matchId;
        }
        return null;
      });
      return matched;
    },
    []
  );

  // Submit score
  const submitScore = useCallback(
    async (correct: boolean, intervalOverride?: number) => {
      if (!currentCard) return;

      if (!isReReview) {
        const matchedGuesses = computeMatches(currentCard, guesses);
        const matchedCount = matchedGuesses.filter(Boolean).length;

        await fetch("/api/review/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userCountryId: currentCard.userCountryId,
            correct,
            ...(intervalOverride !== undefined && { intervalOverride }),
          }),
        });
        setResults((prev) => [
          ...prev,
          { card: currentCard, correct, matchedCount },
        ]);
      }

      if (isReReview) {
        if (reReviewIndex + 1 < reReviewCards.length) {
          setReReviewIndex((i) => i + 1);
          setPhase("guessing");
        } else {
          setPhase("summary");
        }
      } else {
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex((i) => i + 1);
          setPhase("guessing");
        } else {
          setPhase("summary");
        }
      }
    },
    [
      currentCard,
      currentIndex,
      cards.length,
      isReReview,
      reReviewIndex,
      reReviewCards.length,
      guesses,
      computeMatches,
    ]
  );

  // Skip without updating SRS
  const skipCard = useCallback(() => {
    if (currentIndex + 1 < cards.length) {
      setCurrentIndex((i) => i + 1);
      setPhase("guessing");
    } else {
      setPhase("summary");
    }
  }, [currentIndex, cards.length]);

  // Start re-review
  const startReReview = useCallback(() => {
    const incorrect = results.filter((r) => !r.correct).map((r) => r.card);
    setReReviewCards(incorrect);
    setReReviewIndex(0);
    setIsReReview(true);
    setPhase("guessing");
  }, [results]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === "r" && phase === "guessing") {
        setPhase("revealed");
      } else if (phase === "revealed" && currentCard) {
        const isNew = currentCard.reviewCount === 0;
        if (isReReview) {
          if (key === "n") submitScore(true);
        } else if (isNew) {
          if (key === "i") skipCard();
          else if (key === "l") submitScore(true);
          else if (key === "a") submitScore(true, 32);
        } else {
          if (key === "i") submitScore(false);
          else if (key === "c") submitScore(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, currentCard, isReReview, submitScore, skipCard]);

  const formatInterval = (days: number) => {
    if (days <= 1) return "Next review in 1 day";
    return `Next review in ${Math.round(days)} days`;
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  let content: React.ReactNode;

  if (phase === "error") {
    content = (
      <Card className="w-full max-w-lg">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </CardContent>
      </Card>
    );
  } else if (phase === "loading") {
    content = (
      <p className="text-muted-foreground">Loading cards...</p>
    );
  } else if (phase === "summary") {
    const correctCount = results.filter((r) => r.correct).length;
    const totalCount = results.length;
    const incorrectCount = totalCount - correctCount;

    content = (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>
            {isReReview ? "Re-review Complete" : "Session Complete"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalCount > 0 ? (
            <>
              <p className="text-center text-lg">
                {correctCount} / {totalCount} correct
              </p>
              {!isReReview && incorrectCount > 0 && (
                <Button onClick={startReReview} className="w-full">
                  Re-review {incorrectCount} incorrect
                </Button>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground">
              Nothing to review right now.
            </p>
          )}
          <Button variant="outline" asChild className="w-full">
            <a href="/">Back to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  } else {
    // guessing or revealed
    const progress = isReReview
      ? `Re-review ${reReviewIndex + 1} / ${reReviewCards.length}`
      : `${currentIndex + 1} / ${cards.length}`;

    const isNew = currentCard?.reviewCount === 0;

    const correctInterval = currentCard ? currentCard.intervalDays * 2 : 1;
    const incorrectInterval = currentCard
      ? Math.max(currentCard.intervalDays / 2, 1)
      : 1;

    // Compute matches for reveal phase
    const matchedIds =
      phase === "revealed" && currentCard
        ? computeMatches(currentCard, guesses)
        : [];
    const matchedCount = matchedIds.filter(Boolean).length;

    content = (
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {isReReview ? "Re-review" : isNew ? "New Country" : "Review"}
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {progress}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Country name */}
          <div className="text-center space-y-1">
            <p className="text-2xl font-bold">{currentCard?.countryName}</p>
            <p className="text-sm text-muted-foreground">
              {currentCard?.borderCount === 1
                ? "1 bordering country"
                : `${currentCard?.borderCount} bordering countries`}
            </p>
          </div>

          {/* Map toggle */}
          <div className="flex items-center gap-2">
            <input
              id="showMap"
              type="checkbox"
              checked={showMap}
              onChange={(e) => setShowMap(e.target.checked)}
              className="cursor-pointer"
            />
            <label
              htmlFor="showMap"
              className="text-xs text-muted-foreground cursor-pointer"
            >
              Show map
            </label>
          </div>

          {/* Map */}
          {showMap && currentCard && (
            <div className="rounded-lg overflow-hidden border">
              <WorldMap
                highlightCountryId={currentCard.numericId}
                borderCountryIds={
                  phase === "revealed" ? currentCard.borderNumericIds : []
                }
              />
            </div>
          )}

          {/* Guessing phase: inputs */}
          {phase === "guessing" && currentCard && (
            <>
              <div className="space-y-2">
                {Array.from({ length: currentCard.borderCount }).map((_, i) => (
                  <div key={i} className="space-y-1">
                    <Label htmlFor={`border-${i}`} className="text-xs text-muted-foreground">
                      Border {i + 1}
                    </Label>
                    <Input
                      id={`border-${i}`}
                      value={guesses[i] ?? ""}
                      onChange={(e) => {
                        const next = [...guesses];
                        next[i] = e.target.value;
                        setGuesses(next);
                      }}
                      placeholder={`Country ${i + 1}`}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          // Move to next input or reveal
                          if (i < currentCard.borderCount - 1) {
                            document
                              .getElementById(`border-${i + 1}`)
                              ?.focus();
                          } else {
                            setPhase("revealed");
                          }
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
              <Button
                onClick={() => setPhase("revealed")}
                className="w-full"
              >
                Reveal Answer{" "}
                <span className="text-xs opacity-60 ml-1">[R]</span>
              </Button>
            </>
          )}

          {/* Revealed phase */}
          {phase === "revealed" && currentCard && (
            <>
              {/* Score summary */}
              <div className="rounded-lg border p-3 text-center">
                <p className="text-sm font-medium">
                  You got{" "}
                  <span className="text-green-600 font-bold">{matchedCount}</span>
                  {" / "}
                  <span className="font-bold">{currentCard.borderCount}</span>
                </p>
              </div>

              {/* Border list with guess comparison */}
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                  Bordering countries
                </p>
                <div className="rounded-lg border divide-y">
                  {currentCard.borders.map((borderId) => {
                    const borderName =
                      COUNTRY_MAP.get(borderId)?.name ?? borderId;
                    const wasMatched = matchedIds.includes(borderId);

                    return (
                      <div
                        key={borderId}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span
                          className={
                            wasMatched
                              ? "font-medium text-green-700"
                              : "text-foreground"
                          }
                        >
                          {borderName}
                        </span>
                        {wasMatched ? (
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User guesses that didn't match */}
              {guesses.some(
                (g, i) => g.trim() && !matchedIds[i]
              ) && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Your unmatched guesses
                  </p>
                  <div className="rounded-lg border divide-y">
                    {guesses.map((g, i) =>
                      g.trim() && !matchedIds[i] ? (
                        <div
                          key={i}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground italic">
                            {g}
                          </span>
                          <X className="h-4 w-4 text-red-400 shrink-0" />
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Score buttons */}
              <div
                className={`grid gap-2 ${
                  isNew && !isReReview
                    ? "grid-cols-3"
                    : isReReview
                      ? "grid-cols-1"
                      : "grid-cols-2"
                }`}
              >
                {isReReview ? (
                  <Button
                    onClick={() => submitScore(true)}
                    variant="outline"
                    className="w-full"
                  >
                    Next{" "}
                    <span className="text-xs opacity-60 ml-1">[N]</span>
                  </Button>
                ) : isNew ? (
                  <>
                    <Button
                      onClick={skipCard}
                      variant="outline"
                    >
                      Ignore{" "}
                      <span className="text-xs opacity-60">[I]</span>
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => submitScore(true)}
                          variant="outline"
                          className="border-green-200 hover:bg-green-50"
                        >
                          Learn{" "}
                          <span className="text-xs opacity-60">[L]</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{formatInterval(1)}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => submitScore(true, 32)}
                          variant="outline"
                          className="border-blue-200 hover:bg-blue-50"
                        >
                          Already know{" "}
                          <span className="text-xs opacity-60">[A]</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{formatInterval(32)}</TooltipContent>
                    </Tooltip>
                  </>
                ) : (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => submitScore(false)}
                          variant="outline"
                          className="border-red-200 hover:bg-red-50"
                        >
                          Incorrect{" "}
                          <span className="text-xs opacity-60">[I]</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatInterval(incorrectInterval)}
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => submitScore(true)}
                          variant="outline"
                          className="border-green-200 hover:bg-green-50"
                        >
                          Correct{" "}
                          <span className="text-xs opacity-60">[C]</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatInterval(correctInterval)}
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-4">
        {content}
        {phase !== "loading" && phase !== "summary" && (
          <div className="text-center">
            <a href="/" className="text-sm text-muted-foreground underline">
              Back to dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
