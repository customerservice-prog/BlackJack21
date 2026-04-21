// BlackJack 21 - Card Counting Trainer
// Main JavaScript - Game Logic & UI Handler
// INSTRUCTIONS FOR CURSOR: Complete all game functionality including:
// - Card counting with High-Low, Omega II, and Wong Halves systems
// - Virtual blackjack game engine
// - Real-time true count calculation
// - Session tracking and analytics
// - LocalStorage persistence
// - Interactive card counting practice mode

// Game State
const gameState = {
  currentSystem: 'highlow',
    deckCount: 4,
      isGameActive: false,
        deck: [],
          discardPile: [],
            runningCount: 0,
              trueCount: 0,
                dealerHand: [],
                  playerHand: [],
                    sessionStats: {
                        startTime: null,
                            correctAnswers: 0,
                                totalAnswers: 0,
                                    cardsCountedInSession: 0
                                      },
                                        stats: {
                                            totalSessions: 0,
                                                sessions: [],
                                                    systemBreakdown: {
                                                          highlow: { sessions: 0, totalAccuracy: 0 },
                                                                omega2: { sessions: 0, totalAccuracy: 0 },
                                                                      wonghalves: { sessions: 0, totalAccuracy: 0 }
                                                                          }
                                                                            }
                                                                            };

                                                                            // Card counting values for each system
                                                                            const CARD_VALUES = {
                                                                              highlow: {
                                                                                  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
                                                                                      '7': 0, '8': 0, '9': 0,
                                                                                          '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
                                                                                            },
                                                                                              omega2: {
                                                                                                  '2': 1, '3': 1, '4': 2, '5': 2, '6': 2,
                                                                                                      '7': 1, '8': 0, '9': -1,
                                                                                                          '10': -2, 'J': -2, 'Q': -2, 'K': -2, 'A': -2
                                                                                                            },
                                                                                                              wonghalves: {
                                                                                                                  '2': 0.5, '3': 1, '4': 1, '5': 1.5, '6': 1,
                                                                                                                      '7': 0.5, '8': 0, '9': -1,
                                                                                                                          '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -0.5
                                                                                                                            }
                                                                                                                            };
                                                                                                                            
                                                                                                                            const CARD_SUITS = ['♠', '♥', '♦', '♣'];
                                                                                                                            const CARD_RANKS = ['A', '2', '3', '4', '
