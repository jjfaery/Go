/* Bilingual rules & strategy text shown in Learn mode and as reference. */
const RULES = {
  go: {
    title: '围棋 Go (Weiqi) — Rules',
    sections: [
      {
        h: 'Goal',
        p: 'Surround more territory (empty points) and capture more of your opponent\'s stones than they surround/capture of yours. Black plays first.',
      },
      {
        h: 'Liberties (气 qì)',
        p: 'Every stone (or connected group of same-color stones) has "liberties" — empty points directly adjacent (up/down/left/right, not diagonal). A group with zero liberties is captured and removed from the board.',
      },
      {
        h: 'Capturing',
        p: 'If your move removes the last liberty of an opposing group, that entire group is captured immediately and removed. Captured points then usually become your territory.',
      },
      {
        h: 'Suicide is illegal',
        p: 'You may not play a stone that would leave your own group with zero liberties, unless doing so captures an opposing group first (which frees up a liberty).',
      },
      {
        h: 'Ko rule (打劫)',
        p: 'You may not immediately recapture in a way that recreates the exact board position from just before your opponent\'s last capturing move. This prevents infinite repetition. You must play elsewhere first, then can recapture later.',
      },
      {
        h: 'Passing & ending the game',
        p: 'If you have no good move, you may pass. When both players pass in a row, the game enters scoring: click any stone to mark its whole connected group as "dead" (removed for scoring). Once both sides agree, finalize the score.',
      },
      {
        h: 'Scoring (Chinese area scoring)',
        p: 'Each side\'s score = number of their live stones on the board + number of empty points that are completely surrounded only by their stones (territory). White receives a komi bonus (usually 7.5 points) to offset Black\'s first-move advantage. Higher total wins.',
      },
      {
        h: 'Basic strategy tips',
        p: '① Corners are easiest to secure, then sides, then the center — play corners/sides early. ② Keep your groups connected and with plenty of liberties. ③ Don\'t fill in your own territory unnecessarily. ④ Watch for groups you can put in atari (one liberty left) to threaten capture. ⑤ Use the Hint button to see a solid candidate move.',
      },
    ],
  },
  gomoku: {
    title: '五子棋 Wǔzǐqí (Five in a Row) — Rules',
    sections: [
      {
        h: 'Goal',
        p: 'Be the first to get five of your own stones in an unbroken line — horizontal, vertical, or diagonal. Black plays first, on a 15×15 board.',
      },
      {
        h: 'How to play',
        p: 'Players alternate placing one stone per turn on any empty intersection. Stones never move or get captured — the board only fills up.',
      },
      {
        h: 'Winning',
        p: 'The moment a player completes five-in-a-row, the game ends immediately in their favor. If the board fills completely with no five-in-a-row, the game is a draw.',
      },
      {
        h: 'Basic strategy tips',
        p: '① Play near the center early — it opens lines in more directions. ② Watch for "open threes" (three in a row with both ends free) — if unblocked they become an unstoppable open four. ③ A "double threat" (two ways to make five at once) usually wins — try to create one, and watch for your opponent creating one. ④ Blocking is often as important as building your own line. ⑤ Use the Hint button to see a strong candidate move that balances attack and defense.',
      },
    ],
  },
};
