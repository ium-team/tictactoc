import { MODES, type ModeId } from "../domain/game";
import { useGameStore } from "../store/useGameStore";

export function Lobby({ onCreate, onPractice }: { onCreate: () => void; onPractice: () => void }) {
  const { mode, selectMode } = useGameStore();
  return (
    <main className="lobby">
      <section className="hero-copy">
        <p className="eyebrow">NO LOGIN · NO DOWNLOAD · JUST PLAY</p>
        <h1>링크를 던지고,<br /><em>한 수를 둬.</em></h1>
        <p>친구에게 링크 하나만 보내세요. 클래식부터 실제 3D 큐브까지 바로 시작합니다.</p>
        <div className="hero-actions">
          <button className="primary" onClick={onCreate}>새 게임 만들기 <span>↗</span></button>
          <button className="text-button" onClick={onPractice}>혼자 연습하기 →</button>
        </div>
      </section>
      <section className="hero-visual" aria-hidden="true"><div className="preview-grid"><b>×</b><b>○</b><b>×</b></div></section>
      <nav className="modes">
        {(Object.keys(MODES) as ModeId[]).map((id, index) => <button className={mode === id ? "active" : ""} key={id} onClick={() => selectMode(id)}><small>0{index + 1} · {MODES[id].short}</small><strong>{MODES[id].name}</strong></button>)}
      </nav>
    </main>
  );
}
