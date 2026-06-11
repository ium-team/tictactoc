import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { useGameStore } from "../store/useGameStore";

function CubeCell({ index, onMove }: { index: number; onMove: (index: number) => void }) {
  const { game, role, practice, pending, connection } = useGameStore();
  const x = index % 3 - 1;
  const y = 1 - (Math.floor(index / 3) % 3);
  const z = Math.floor(index / 9) - 1;
  const mark = game.board[index];
  const canPlay = !game.winner && !mark && !pending && (practice || connection === "connected") && game.turn === role;
  const active = game.winLine.includes(index);
  return (
    <group position={[x * 1.25, y * 1.25, z * 1.25]}>
      <mesh
        onClick={(event) => { event.stopPropagation(); if (canPlay) onMove(index); }}
        onPointerOver={() => { document.body.style.cursor = canPlay ? "pointer" : "grab"; }}
        onPointerOut={() => { document.body.style.cursor = "default"; }}
      >
        <boxGeometry args={[.92, .92, .92]} />
        <meshPhysicalMaterial
          color={mark === "X" ? "#dbeafe" : mark === "O" ? "#eef2ff" : active ? "#bfdbfe" : "#ffffff"}
          transparent opacity={mark ? .96 : .62} roughness={.3} metalness={0} transmission={mark ? 0 : .08}
        />
      </mesh>
      {mark && <Text position={[0, 0, .48]} fontSize={.48} color={mark === "X" ? "#2563eb" : "#111827"} anchorX="center" anchorY="middle">{mark === "X" ? "×" : "○"}</Text>}
    </group>
  );
}

export function Board3D({ onMove }: { onMove: (index: number) => void }) {
  return (
    <div className="board-3d" aria-label="3D 틱택토 게임 보드">
      <Canvas camera={{ position: [6, 5, 7], fov: 40 }} dpr={[1, 1.7]}>
        <ambientLight intensity={1.7} />
        <directionalLight position={[5, 7, 5]} intensity={2.2} />
        <group rotation={[-.15, .2, 0]}>{Array.from({ length: 27 }, (_, index) => <CubeCell index={index} key={index} onMove={onMove} />)}</group>
        <OrbitControls enablePan={false} minDistance={6} maxDistance={11} rotateSpeed={.75} />
      </Canvas>
    </div>
  );
}
