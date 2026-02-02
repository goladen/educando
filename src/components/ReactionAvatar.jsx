import React from 'react';
import { Zap, Star } from 'lucide-react';

const STYLES = `
  .avatar-container {
    position: relative;
    width: 130px;
    height: 130px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 50;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3));
    transition: transform 0.3s;
  }

  /* ESTADOS */
  .avatar-happy .avatar-img { 
    transform: scale(1.1) rotate(-10deg); 
  }
  
  .avatar-angry .avatar-img { 
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  }

  /* PARTICULAS (Estrellas) */
  .particle-star {
    position: absolute;
    color: #f1c40f;
    animation: flyOut 0.8s ease-out forwards;
    z-index: 51;
    opacity: 0;
  }

  /* PARTICULAS (Rayos) */
  .particle-zap {
    position: absolute;
    color: #f1c40f;
    animation: flash 0.5s ease-in-out infinite alternate;
    z-index: 51;
  }

  /* ANIMACIONES */
  @keyframes shake {
    10%, 90% { transform: translate3d(-2px, 0, 0) rotate(5deg); }
    20%, 80% { transform: translate3d(4px, 0, 0) rotate(-5deg); }
    30%, 50%, 70% { transform: translate3d(-6px, 0, 0) rotate(5deg); }
    40%, 60% { transform: translate3d(6px, 0, 0) rotate(-5deg); }
  }

  @keyframes flyOut {
    0% { transform: translate(0, 0) scale(0.5); opacity: 1; }
    100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
  }

  @keyframes flash {
    0% { opacity: 0; transform: scale(0.8); }
    100% { opacity: 1; transform: scale(1.2); }
  }
`;

export default function ReactionAvatar({ mood }) {
    // mood: 'neutral', 'happy', 'angry'

    // URL BASE
    let avatarUrl = "https://api.dicebear.com/9.x/bottts/svg?seed=Aidan";

    if (mood === 'happy') {
        // Boca sonriente
        avatarUrl += "&mouth=smile01&eyes=round";
    } else if (mood === 'angry') {
        // CORRECCIÓN: 'grimace' no existe en robots, usamos 'grill03' (dientes apretados)
        avatarUrl += "&eyes=bulging&mouth=grill03";
    } else {
        // Estado normal
        avatarUrl += "&eyes=round&mouth=square01";
    }

    const renderStars = () => {
        const stars = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * 360;
            const distance = 80;
            const tx = Math.cos(angle * (Math.PI / 180)) * distance + 'px';
            const ty = Math.sin(angle * (Math.PI / 180)) * distance + 'px';
            stars.push(
                <div key={i} className="particle-star" style={{ '--tx': tx, '--ty': ty }}>
                    <Star size={24} fill="#f1c40f" stroke="orange" />
                </div>
            );
        }
        return stars;
    };

    return (
        <div className="avatar-wrapper">
            <style>{STYLES}</style>
            <div className={`avatar-container avatar-${mood}`}>

                {/* EFECTOS */}
                {mood === 'happy' && renderStars()}

                {mood === 'angry' && (
                    <>
                        <div className="particle-zap" style={{ top: -30, right: -20 }}><Zap size={40} fill="#f1c40f" stroke="orange" /></div>
                        <div className="particle-zap" style={{ bottom: -20, left: -30, animationDelay: '0.1s' }}><Zap size={30} fill="#f1c40f" stroke="orange" /></div>
                    </>
                )}

                {/* IMAGEN DEL ROBOT */}
                <img src={avatarUrl} alt="Robot Avatar" className="avatar-img" />
            </div>
        </div>
    );
}