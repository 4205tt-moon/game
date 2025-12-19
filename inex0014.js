 // 獲取遊戲畫布和上下文
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // 遊戲參數設定
    const TILE_SIZE = 20; // 每個方塊的像素大小
    const GRID_SIZE = 30; // 網格尺寸 (30x30)
    const COLORS = ['red', 'blue', 'green', 'yellow']; // 四個陣營的顏色
    
    // 四個角落的位置
    const CORNERS = [
      { x: 0, y: 0 },                   // 左上角
      { x: GRID_SIZE - 1, y: 0 },       // 右上角
      { x: 0, y: GRID_SIZE - 1 },       // 左下角
      { x: GRID_SIZE - 1, y: GRID_SIZE - 1 } // 右下角
    ];

    // 陣營平衡設定
    const UNIT_STATS = {
      red:   { hp: 300, atk: 40, spawnRate: 3, unitsPerSpawn: 1 },   // 紅色: 高攻擊，慢生成
      blue:  { hp: 300, atk: 15, spawnRate: 2, unitsPerSpawn: 2 },   // 藍色: 平衡型
      green: { hp: 150, atk: 10, spawnRate: 1, unitsPerSpawn: 5 },   // 綠色: 低生命，快生成，一次多個
      yellow:{ hp: 400, atk: 18, spawnRate: 3, unitsPerSpawn: 1 }    // 黃色: 高生命，慢生成
    };

    // 基地初始血量
    const BASE_HP = 1000;

    // 遊戲狀態變數
    let grid = []; // 網格狀態
    let units = []; // 所有單位
    let specialTiles = []; // 特殊方塊位置
    let controlCounters = { red: 0, blue: 0, green: 0, yellow: 0 }; // 各陣營控制計數
    let spawnCounters = { red: 0, blue: 0, green: 0, yellow: 0 }; // 各陣營生成計數
    let battleEffects = []; // 戰鬥特效
    let gameRunning = false; // 遊戲是否運行中
    let gameSpeed = 1.0; // 遊戲速度倍率
    let lastUpdateTime = 0; // 最後更新時間
    const NORMAL_SPEED = 100; // 正常速度的更新間隔(毫秒)
    
    // 單位目標分配狀態
    let unitTargets = new Map(); // 單位目標映射
    let targetEvaluationTimer = 0; // 目標評估計時器
    
    // 基地血量狀態
    let baseHealth = {
      red: BASE_HP,
      blue: BASE_HP,
      green: BASE_HP,
      yellow: BASE_HP
    };
    
    // 基地位置映射 (顏色 -> 位置)
    let basePositions = {};
    
    /**
     * 隨機分配基地位置到四個角落
     */
    function assignRandomBasePositions() {
      // 複製顏色陣列並隨機排序
      let shuffledColors = [...COLORS];
      for (let i = shuffledColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
      }
      
      // 分配顏色到角落
      basePositions = {};
      for (let i = 0; i < CORNERS.length; i++) {
        basePositions[shuffledColors[i]] = CORNERS[i];
      }
      
      console.log("基地位置分配:", basePositions);
    }
    
    /**
     * 創建慶祝效果的彩色紙屑
     */
    function createConfetti() {
      const modal = document.getElementById('gameOverModal');
      const colors = ['#ff4d4d', '#4da6ff', '#4dff88', '#ffcc00', '#ff6b6b', '#48dbfb', '#1dd1a1', '#feca57'];
      
      for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confetti.style.width = (Math.random() * 10 + 5) + 'px';
        confetti.style.height = (Math.random() * 10 + 5) + 'px';
        modal.appendChild(confetti);
      }
    }
    
    /**
     * 更新基地血量顯示
     */
    function updateBaseHealthDisplay() {
      for (let color of COLORS) {
        const healthPercent = (baseHealth[color] / BASE_HP) * 100;
        const healthBar = document.getElementById(`${color}-health-bar`);
        const healthText = document.getElementById(`${color}-health`);
        
        // 更新血條寬度
        healthBar.style.width = `${healthPercent}%`;
        
        // 更新血量文字
        healthText.textContent = `${baseHealth[color]}/${BASE_HP}`;
        
        // 如果血量低於30%，添加低血量警告效果
        if (healthPercent < 30) {
          healthBar.classList.add('low-health');
          healthText.style.color = '#ff4d4d';
        } else {
          healthBar.classList.remove('low-health');
          healthText.style.color = '#ccc';
        }
      }
    }
    
    /**
     * 更新控制條顯示
     */
    function updateControlBars() {
      const totalSpecial = specialTiles.length;
      
      for (let color of COLORS) {
        const percent = totalSpecial > 0 ? (controlCounters[color] / totalSpecial) * 100 : 0;
        document.getElementById(`${color}-control`).style.width = `${percent}%`;
        document.getElementById(`${color}-value`).textContent = controlCounters[color];
      }
    }

    /**
     * 初始化遊戲網格
     */
    function initGrid() {
      grid = [];
      units = [];
      specialTiles = [];
      battleEffects = [];
      controlCounters = { red: 0, blue: 0, green: 0, yellow: 0 };
      spawnCounters = { red: 0, blue: 0, green: 0, yellow: 0 };
      unitTargets.clear();
      targetEvaluationTimer = 0;
      
      // 初始化基地血量
      baseHealth = {
        red: BASE_HP,
        blue: BASE_HP,
        green: BASE_HP,
        yellow: BASE_HP
      };
      
      // 隨機分配基地位置
      assignRandomBasePositions();
      
      // 更新基地血量顯示
      updateBaseHealthDisplay();
      
      // 初始化網格
      for (let y = 0; y < GRID_SIZE; y++) {
        let row = [];
        for (let x = 0; x < GRID_SIZE; x++) {
          row.push({ owner: null, isSpecial: false });
        }
        grid.push(row);
      }
      
      // 設定陣營基地（四個角落，隨機分配）
      for (let color of COLORS) {
        const base = basePositions[color];
        grid[base.y][base.x].owner = color;
      }
      
      // 隨機生成特殊方塊 (避開角落)
      for (let i = 0; i < 10; i++) {
        let x, y;
        do {
          x = Math.floor(Math.random() * GRID_SIZE);
          y = Math.floor(Math.random() * GRID_SIZE);
        } while (grid[y][x].isSpecial || 
                (x === 0 && y === 0) || 
                (x === GRID_SIZE - 1 && y === 0) || 
                (x === 0 && y === GRID_SIZE - 1) || 
                (x === GRID_SIZE - 1 && y === GRID_SIZE - 1));
          
        grid[y][x].isSpecial = true;
        specialTiles.push({ x, y });
      }
      
      // 生成初始單位
      spawnInitialUnits();
      updateControlBars();
    }

    /**
     * 生成初始單位
     */
    function spawnInitialUnits() {
      const initialCounts = {
        red: 2,
        blue: 5,
        green: 7,
        yellow: 3
      };

      for (let color of COLORS) {
        const base = basePositions[color];
        
        for (let i = 0; i < initialCounts[color]; i++) {
          const unit = {
            id: Math.random().toString(36).substr(2, 9), // 唯一ID
            x: base.x,
            y: base.y,
            color,
            hp: UNIT_STATS[color].hp,
            maxHp: UNIT_STATS[color].hp,
            target: null,
            lastTargetUpdate: 0
          };
          units.push(unit);
          unitTargets.set(unit.id, null);
        }
      }
    }

    /**
     * 生成新單位
     */
    function spawnUnits() {
      for (let color of COLORS) {
        // 如果基地被摧毀，不再生成單位
        if (baseHealth[color] <= 0) continue;
        
        spawnCounters[color] += controlCounters[color];
        
        if (spawnCounters[color] >= UNIT_STATS[color].spawnRate) {
          spawnCounters[color] = 0;
          
          for (let i = 0; i < UNIT_STATS[color].unitsPerSpawn; i++) {
            const base = basePositions[color];
            const unit = {
              id: Math.random().toString(36).substr(2, 9),
              x: base.x,
              y: base.y,
              color,
              hp: UNIT_STATS[color].hp,
              maxHp: UNIT_STATS[color].hp,
              target: null,
              lastTargetUpdate: 0
            };
            units.push(unit);
            unitTargets.set(unit.id, null);
          }
        }
      }
    }

    /**
     * 智能目標分配函數
     */
    function assignSmartTarget(unit) {
      const candidateTargets = [];
      
      // 1. 空白特殊方塊 (最高優先級)
      const blankSpecialTiles = specialTiles.filter(({x, y}) => !grid[y][x].owner);
      for (const tile of blankSpecialTiles) {
        const distance = Math.abs(tile.x - unit.x) + Math.abs(tile.y - unit.y);
        candidateTargets.push({ type: 'blank-special', ...tile, distance });
      }
      
      // 2. 敵方單位
      const enemies = units.filter(u => u.color !== unit.color);
      for (const enemy of enemies) {
        const distance = Math.abs(enemy.x - unit.x) + Math.abs(enemy.y - unit.y);
        candidateTargets.push({ type: 'enemy-unit', ...enemy, distance });
      }
      
      // 3. 敵方控制的特殊方塊
      const enemySpecialTiles = specialTiles.filter(({x, y}) => 
        grid[y][x].owner && grid[y][x].owner !== unit.color);
      for (const tile of enemySpecialTiles) {
        const distance = Math.abs(tile.x - unit.x) + Math.abs(tile.y - unit.y);
        candidateTargets.push({ type: 'enemy-special', ...tile, distance });
      }
      
      // 4. 敵方基地 (最低優先級)
      for (let color of COLORS) {
        if (color !== unit.color && baseHealth[color] > 0) {
          const base = basePositions[color];
          const distance = Math.abs(base.x - unit.x) + Math.abs(base.y - unit.y);
          candidateTargets.push({ type: 'enemy-base', ...base, distance });
        }
      }
      
      if (candidateTargets.length === 0) return null;
      
      // 按距離排序
      candidateTargets.sort((a, b) => a.distance - b.distance);
      
      // 從最近的3個目標中隨機選擇一個
      const topTargets = candidateTargets.slice(0, Math.min(3, candidateTargets.length));
      const randomTarget = topTargets[Math.floor(Math.random() * topTargets.length)];
      
      return randomTarget;
    }

    /**
     * 單位移動邏輯
     */
    function moveUnit(unit, timestamp) {
      // 每5秒重新評估目標
      if (!unit.target || (timestamp - unit.lastTargetUpdate > 5000)) {
        unit.target = assignSmartTarget(unit);
        unit.lastTargetUpdate = timestamp;
      }
      
      if (!unit.target) return;
      
      // 計算移動方向
      let dx = Math.sign(unit.target.x - unit.x);
      let dy = Math.sign(unit.target.y - unit.y);
      
      // 10%機率隨機移動 (增加不可預測性)
      if (Math.random() < 0.1) {
        dx = Math.random() < 0.5 ? -1 : 1;
        dy = Math.random() < 0.5 ? -1 : 1;
      }
      
      // 移動單位 (限制在網格範圍內)
      unit.x = Math.max(0, Math.min(GRID_SIZE - 1, unit.x + dx));
      unit.y = Math.max(0, Math.min(GRID_SIZE - 1, unit.y + dy));
      
      // 檢查是否進入敵方基地
      for (let color of COLORS) {
        if (color !== unit.color && baseHealth[color] > 0) {
          const base = basePositions[color];
          if (unit.x === base.x && unit.y === base.y) {
            // 對基地造成傷害
            baseHealth[color] -= UNIT_STATS[unit.color].atk;
            if (baseHealth[color] < 0) baseHealth[color] = 0;
            
            // 更新基地血量顯示
            updateBaseHealthDisplay();
          }
        }
      }
      
      // 如果到達目標，清除目標
      if (unit.x === unit.target.x && unit.y === unit.target.y) {
        unit.target = null;
      }
    }

    /**
     * 更新所有單位狀態
     */
    function updateUnits(timestamp) {
      // 移動所有單位
      for (let unit of units) moveUnit(unit, timestamp);
      
      // 佔領特殊方塊
      for (let unit of units) {
        let tile = grid[unit.y][unit.x];
        if (tile.isSpecial && tile.owner !== unit.color) {
          tile.owner = unit.color;
        }
      }
      
      // 處理單位戰鬥
      const positionMap = {};
      for (const unit of units) {
        const key = `${unit.x},${unit.y}`;
        (positionMap[key] || (positionMap[key] = [])).push(unit);
      }
      
      const survivors = [];
      for (const key in positionMap) {
        const unitsAtPos = positionMap[key];
        if (unitsAtPos.length > 1) {
          // 計算每個顏色的總攻擊力
          const attackSums = {};
          for (const unit of unitsAtPos) {
            attackSums[unit.color] = (attackSums[unit.color] || 0) + UNIT_STATS[unit.color].atk;
          }
          
          // 對每個單位造成傷害
          for (const unit of unitsAtPos) {
            let damage = 0;
            for (const color in attackSums) {
              if (color !== unit.color) {
                damage += attackSums[color];
              }
            }
            unit.hp -= damage;
            
            // 如果單位死亡，創建戰鬥特效
            if (unit.hp <= 0) {
              // *** 修正: 直接儲存網格座標 (x, y) ***
              battleEffects.push({
                x: unit.x, // 網格 X
                y: unit.y, // 網格 Y
                color: unit.color,
                start: Date.now()
              });
            }
            
            // 如果單位存活，加入倖存者列表
            if (unit.hp > 0) survivors.push(unit);
          }
        } else {
          // 沒有戰鬥，所有單位存活
          survivors.push(...unitsAtPos);
        }
      }
      
      units = survivors;
    }

    /**
     * 更新控制狀態
     */
    function updateControl() {
      // 重置控制計數
      for (let color of COLORS) controlCounters[color] = 0;
      
      // 計算每個陣營控制的特殊方塊數量
      for (let { x, y } of specialTiles) {
        let owner = grid[y][x].owner;
        if (owner) controlCounters[owner]++;
      }
      
      // 更新控制條顯示
      updateControlBars();
    }

    /**
     * 檢查勝利條件
     */
    function checkVictory() {
      // 檢查是否有基地被摧毀
      const destroyedBases = [];
      for (let color of COLORS) {
        if (baseHealth[color] <= 0) {
          destroyedBases.push(color);
        }
      }
      
      // 如果只有一個陣營的基地存活，該陣營獲勝
      const aliveBases = COLORS.filter(color => baseHealth[color] > 0);
      if (aliveBases.length === 1) {
        showGameOver(`${aliveBases[0]} 陣營勝利！`);
        return true;
      }
      
      // 檢查是否所有特殊方塊都被同一陣營控制
      let aliveColors = new Set(units.map(u => u.color));
      
      for (let color of COLORS) {
        if (!aliveColors.has(color)) continue;
        
        let allSpecialOwned = specialTiles.every(({x, y}) => grid[y][x].owner === color);
        
        if (allSpecialOwned && aliveColors.size === 1) {
          showGameOver(`${color} 陣營勝利！`);
          return true;
        }
      }
      return false;
    }

    /**
     * 繪製遊戲網格
     */
    function drawGrid() {
      // 清除畫布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 繪製網格和特殊方塊
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          let tile = grid[y][x];
          ctx.strokeStyle = '#333';
          ctx.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          
          // 繪製特殊方塊
          if (tile.isSpecial) {
            ctx.fillStyle = tile.owner || '#444';
            ctx.fillRect(x * TILE_SIZE + 4, y * TILE_SIZE + 4, 12, 12);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '12px sans-serif';
            ctx.fillText('★', x * TILE_SIZE + 6, y * TILE_SIZE + 15);
          }
        }
      }
      
      // 繪製單位
      for (let unit of units) {
        ctx.fillStyle = unit.color;
        ctx.fillRect(unit.x * TILE_SIZE + 2, unit.y * TILE_SIZE + 2, 16, 16);
        
        // 繪製單位血量條
        const hpPercent = unit.hp / unit.maxHp;
        ctx.fillStyle = '#333';
        ctx.fillRect(unit.x * TILE_SIZE, unit.y * TILE_SIZE - 5, TILE_SIZE, 4);
        ctx.fillStyle = hpPercent > 0.6 ? '#4CAF50' : hpPercent > 0.3 ? '#FFC107' : '#F44336';
        ctx.fillRect(unit.x * TILE_SIZE, unit.y * TILE_SIZE - 5, TILE_SIZE * hpPercent, 4);
        
        // 繪製單位目標線
        if (unit.target) {
          ctx.beginPath();
          ctx.moveTo(unit.x * TILE_SIZE + TILE_SIZE/2, unit.y * TILE_SIZE + TILE_SIZE/2);
          ctx.lineTo(unit.target.x * TILE_SIZE + TILE_SIZE/2, unit.target.y * TILE_SIZE + TILE_SIZE/2);
          ctx.strokeStyle = unit.color;
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // 繪製目標點
          ctx.fillStyle = unit.color;
          ctx.beginPath();
          ctx.arc(unit.target.x * TILE_SIZE + TILE_SIZE/2, 
                  unit.target.y * TILE_SIZE + TILE_SIZE/2, 
                  3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      // 繪製基地
      for (let color of COLORS) {
        if (baseHealth[color] <= 0) continue; // 如果基地被摧毀，不繪製
        
        const base = basePositions[color];
        
        // 繪製基地血量背景
        const healthPercent = baseHealth[color] / BASE_HP;
        ctx.fillStyle = '#333';
        ctx.fillRect(base.x * TILE_SIZE, base.y * TILE_SIZE - 8, TILE_SIZE, 4);
        
        // 繪製基地血量
        ctx.fillStyle = color;
        ctx.fillRect(base.x * TILE_SIZE, base.y * TILE_SIZE - 8, TILE_SIZE * healthPercent, 4);
        
        // 繪製基地圓形
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(
          base.x * TILE_SIZE + TILE_SIZE/2, 
          base.y * TILE_SIZE + TILE_SIZE/2, 
          TILE_SIZE/2 - 2, 
          0, 
          Math.PI * 2
        );
        ctx.fill();
        
        // 繪製基地標識文字
        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.fillText('基', base.x * TILE_SIZE + 6, base.y * TILE_SIZE + 14);
      }
    }
    
    /**
     * 繪製戰鬥特效 (已修改: 直接在主 ctx 繪製，移除動態 Canvas)
     */
    function drawBattleEffects() {
      const now = Date.now();
      battleEffects = battleEffects.filter(effect => {
        const elapsed = now - effect.start;
        // 特效持續 500ms
        if (elapsed > 500) return false; 
        
        // 計算特效大小 (從 0.5x 放大到 1.5x)
        const size = (elapsed / 500) * (TILE_SIZE * 1.5);
        // 計算透明度 (從 1 漸變到 0)
        const alpha = 1 - (elapsed / 500);
        
        // 計算特效中心點的像素座標
        const pixelX = effect.x * TILE_SIZE + TILE_SIZE/2;
        const pixelY = effect.y * TILE_SIZE + TILE_SIZE/2;
        
        // *** 核心修正：直接在主 ctx 上繪製 ***
        ctx.save(); // 儲存當前繪圖狀態
        ctx.globalAlpha = alpha; // 應用透明度
        ctx.fillStyle = effect.color;
        
        // 繪製圓形特效 (模擬爆炸或閃光)
        ctx.beginPath();
        ctx.arc(pixelX, pixelY, size * 0.5, 0, Math.PI * 2); 
        ctx.fill();
        
        ctx.restore(); // 恢復繪圖狀態
        
        return true; // 特效還在持續中
      });
    }

    /**
     * 遊戲主循環
     */
    function gameLoop(timestamp) {
      if (!gameRunning) return;
      
      if (!lastUpdateTime) lastUpdateTime = timestamp;
      
      // 根據遊戲速度計算更新間隔
      const updateInterval = NORMAL_SPEED / gameSpeed;
      const delta = timestamp - lastUpdateTime;
      
      // 如果達到更新間隔，更新遊戲狀態
      if (delta > updateInterval) {
        if (!checkVictory()) {
          updateUnits(timestamp);
          updateControl();
          spawnUnits();
        }
        lastUpdateTime = timestamp;
      }
      
      // 繪製遊戲畫面
      drawGrid();
      drawBattleEffects();
      
      // 繼續遊戲循環
      requestAnimationFrame(gameLoop);
    }
    
    /**
     * 顯示遊戲結束彈窗
     */
    function showGameOver(message) {
      gameRunning = false;
      document.getElementById('winnerText').textContent = message;
      
      // 顯示彈窗
      const modal = document.getElementById('gameOverModal');
      modal.style.display = 'flex';
      
      // 創建慶祝效果
      createConfetti();
    }

    // 遊戲初始化
    // 開始遊戲按鈕點擊事件
    document.getElementById('startButton').addEventListener('click', () => {
      document.getElementById('startButton').style.display = 'none';
      canvas.style.display = 'block';
      initGrid();
      gameRunning = true;
      lastUpdateTime = 0;
      requestAnimationFrame(gameLoop);
    });
    
    // 重新開始按鈕點擊事件
    document.getElementById('restartButton').addEventListener('click', () => {
      const modal = document.getElementById('gameOverModal');
      modal.style.display = 'none';
      
      // 清除所有紙屑
      const confettiElements = document.querySelectorAll('.confetti');
      confettiElements.forEach(el => el.remove());
      
      initGrid();
      gameRunning = true;
      lastUpdateTime = 0;
      requestAnimationFrame(gameLoop);
    });
    
    // 返回主菜單按鈕點擊事件
    document.getElementById('mainMenuButton').addEventListener('click', () => {
      const modal = document.getElementById('gameOverModal');
      modal.style.display = 'none';
      
      // 清除所有紙屑
      const confettiElements = document.querySelectorAll('.confetti');
      confettiElements.forEach(el => el.remove());
      
      document.getElementById('startButton').style.display = 'block';
      canvas.style.display = 'none';
      gameRunning = false;
    });
    
    // 速度控制滑塊事件監聽
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    
    speedSlider.addEventListener('input', () => {
      gameSpeed = 0.5 + (speedSlider.value - 1) * 0.1667;
      speedValue.textContent = gameSpeed.toFixed(1) + 'x';
    });
    
    // 目標資訊顯示切換按鈕事件監聽
    document.getElementById('toggleTargetInfo').addEventListener('click', () => {
      const infoPanel = document.getElementById('targetInfo');
      if (infoPanel.style.display === 'block') {
        infoPanel.style.display = 'none';
        document.getElementById('toggleTargetInfo').textContent = '顯示目標資訊';
      } else {
        infoPanel.style.display = 'block';
        document.getElementById('toggleTargetInfo').textContent = '隱藏目標資訊';
      }
    });