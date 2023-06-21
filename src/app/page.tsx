'use client'

import { Chess } from 'chess.js'
import { Configuration, OpenAIApi } from 'openai'
import { useEffect, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import styles from './chess.module.css'
import { KeyStrokes } from './components/KeyStrokes'

type Player = {
  color: 'white' | 'black';
  temperature: number;
  wins: number;
  draws: number;
}

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
}));

export default function ChessGame() {
  const [players, setPlayers] = useState<Player[]>([
    {
      color: 'white',
      temperature: 0,
      wins: 0,
      draws: 0,
    },
    {
      color: 'black',
      temperature: 1,
      wins: 0,
      draws: 0,
    },
  ]);

  const [game, setGame] = useState(new Chess());
  const [moves, setMoves] = useState<string[]>([]);
  const [start, setStart] = useState(false);
  const [activePlayer, setActivePlayer] = useState(0);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [winner, setWinner] = useState("Start the game to find the winner");

  const currentPlayer = useRef(activePlayer);
  const isRunning = useRef(start);
  const allMoves = useRef(moves);
  const currentMoveIndexRef = useRef(currentMoveIndex);
  const timer = useRef<any>(null);

  useEffect(() => {
    currentPlayer.current = activePlayer;
    isRunning.current = start;
    allMoves.current = moves;
    currentMoveIndexRef.current = currentMoveIndex;
  }, [activePlayer, start, moves, currentMoveIndex]);

  useEffect(() => {
    if (start) {
      makeMove();
    } else {
      timer.current && clearTimeout(timer.current);
    }
  }, [start]);

  const makeMove = async () => {
    if (!isRunning.current) {
      return;
    }

    if (game.isGameOver()) {
      setWinner(getWinner());
      setStart(false);
      return;
    }

    const move = await getNextMove();

    game.move(move);
    setMoves([
      `${currentMoveIndexRef.current + 1}: Player ${currentPlayer.current + 1}: ${move}`,
      ...allMoves.current,
    ])

    const nextPlayer = (currentPlayer.current + 1) % 2;

    setActivePlayer(nextPlayer);
    setCurrentMoveIndex(currentMoveIndexRef.current + 1);

    timer.current = setTimeout(async () => {
      await makeMove();
    }, 1000);
  }

  const generatePrompt = () => {
    return `
You are a pro chess player, and you are playing a chess match against another pro chess player.
You goal is to play to your best effort, and try your best to win the game.
Your color is ${players[currentPlayer.current].color}.

The current FEN is:
${game.fen()}

The current PGN is:
${game.pgn()}

You need to make the next move. Following is a list of the next possible valid moves that you can choose from.
${game.moves().map(move => `- ${move}`).join("\n")}

Pick a move only from the above list of possible moves.

Try your best to pick a move that maximizes your chance of winning.

Give your response using the following JSON format:

{
  "move": "Your move"
}

For example:

{
  "move": "e5"
}

Make sure that the returned JSON is valid and can be parsed by JSON.parse() in Typescript.

Your response should only contain the JSON response, and no explanation or anything else.
`
  }

  const getNextMove = async () => {
    const prompt = generatePrompt();

    const response = await getNextMoveFromGpt(prompt, players[currentPlayer.current].temperature);

    const move = JSON.parse(response).move;

    return move;
  }

  const getNextMoveFromGpt = async (prompt: string, temperature: number) => {
    let retriesLeft = 3;
    while (retriesLeft) {
      try {
        const response = await openai.createChatCompletion({
          model: 'gpt-3.5-turbo',
          temperature,
          messages: [
            {
              role: "system",
              content: "You are a pro chess player. You will play chess with another player, and try your best to win the game",
            },
            {
              role: "user",
              content: prompt,
            }
          ]
        }, {
          timeout: 10 * 1000,
        });

        return response.data.choices[0].message?.content as string;
      } catch (e) {
        retriesLeft--;
        console.log(`Retries Remaining: ${retriesLeft}`);
      }
    }
    throw new Error("Could not get a response on time");
  }

  const getWinner = () => {
    const player1 = { ...players[0] };
    const player2 = { ...players[1] };
    let winner = "";

    if (game.isCheckmate()) {
      if (game.turn() == 'w') {
        player2.wins++;
        winner = "Player 2";
      } else if (game.turn() == 'b') {
        player1.wins++;
        winner = "Player 1";
      }
    } else if (game.isDraw()) {
      player1.draws++;
      player2.draws++;
      winner = "Draw";
    } else {
      winner = "No Winner";
    }

    setPlayers([player1, player2]);
    return winner;
  }

  const onClickStart = () => {
    if (start) {
      setWinner("Resume the game...");
    } else {
      setWinner("Game in progress...");
    }

    setStart(!start);
  }

  const resetGame = () => {
    setGame(new Chess());
    setMoves([]);
    setStart(false);
    setActivePlayer(0);
    setCurrentMoveIndex(0);
    setWinner("Start the game to find the winner")
  }

  return (
    <div className={styles.columnContainer}>
      <KeyStrokes />
      <div className={`${styles.rowContainer} ${styles.container}`}>
        <div className={`${styles.column} ${styles.chessBoardContainer}`}>
          <div>
            <Chessboard id="BasicBoard" position={game.fen()} />
          </div>
          <div className={styles.rowContainer}>
            {
              players.map((player, index) => {
                return (
                  <div key={`player-${index}`} className={styles.columnContainer}>
                    <div>
                      Player: {index + 1}
                    </div>
                    <div>
                      Color: {player.color}
                    </div>
                    <div>
                      Temperature: {player.temperature}
                    </div>
                    <div>
                      Wins: {player.wins}
                    </div>
                    <div>
                      Draws: {player.draws}
                    </div>
                  </div>
                )
              })
            }
          </div>
        </div>
        <div className={styles.column}>
          <button
            className={styles.button}
            onClick={onClickStart}
          >
            {start ? 'Stop Game' : 'Start Game!'}
          </button>
          <button
            className={styles.button}
            onClick={resetGame}
            disabled={start}
          >
            Reset
          </button>
          <div>
            Current Player: {activePlayer + 1}
          </div>
          <div>
            Winner: {winner}
          </div>
          <div>
            Moves:
          </div>
          {
            moves.map(move => {
              return (
                <div key={`${move}-${new Date().getTime()}`}>
                  {move}
                </div>
              )
            })
          }
        </div>
      </div>
    </div>
  );
}
