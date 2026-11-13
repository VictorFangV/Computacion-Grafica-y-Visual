
export const CONFIG = {
  player: {
    speed: 5.0,         
    radius: 0.35,       
    eyeHeight: 1.6,
    sensitivity: 0.0022, 
  },

  weapons: [
    {
      id: 'pistol', name: 'PISTOLA', url: 'models/pistol.glb',
      startAmmo: 15,     
      maxAmmo: 60,
      pickupAmmo: 6,     
      cooldown: 0.28,    
      hitPadding: 0.0, 
    
      view: { size: 0.38, pos: [0.26, -0.24, -0.55], rot: [0, 0, 0], muzzle: [0.26, -0.2, -0.78], recoil: 0.1 },
    },
    {
      id: 'shotgun', name: 'ESCOPETA', url: 'models/shotgun.glb',
      startAmmo: 6,
      maxAmmo: 30,
      pickupAmmo: 3,
      cooldown: 0.85,
      hitPadding: 0.3,
      view: { size: 0.85, pos: [0.28, -0.27, -0.72], rot: [0, 0, 0], muzzle: [0.28, -0.22, -1.17], recoil: 0.18 },
    },
  ],

  zombie: {
    url: 'models/zombie.glb',
    height: 1.8,
    hp: 2,              
    speed: 2.3,
    fastSpeed: 4.4,      
    detectRange: 13,    
    catchDistance: 1.0,  
    yawOffset: 0,       
  },

  shootRange: 60,
  pickupRadius: 1.3,
  extractionRadius: 2.6,
};
