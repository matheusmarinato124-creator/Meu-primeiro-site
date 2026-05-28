// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('Erro no banco:', err.message);
    else {
        console.log('Conectado ao SQLite.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, acesso TEXT UNIQUE NOT NULL, senha TEXT NOT NULL, perfil TEXT NOT NULL)`);
            db.run(`CREATE TABLE IF NOT EXISTS turmas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL)`);
            db.run(`CREATE TABLE IF NOT EXISTS alunos (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, turma_id INTEGER, FOREIGN KEY(turma_id) REFERENCES turmas(id))`);
            db.run(`CREATE TABLE IF NOT EXISTS chamadas (id INTEGER PRIMARY KEY AUTOINCREMENT, turma_id INTEGER, data TEXT NOT NULL)`);
            db.run(`CREATE TABLE IF NOT EXISTS presencas (id INTEGER PRIMARY KEY AUTOINCREMENT, chamada_id INTEGER, aluno_id INTEGER, status TEXT NOT NULL)`);

            db.get("SELECT COUNT(*) as qtd FROM usuarios", [], (err, row) => {
                if (row.qtd === 0) {
                    db.run("INSERT INTO usuarios (nome, acesso, senha, perfil) VALUES (?, ?, ?, ?)", ["Diretor Admin", "admin", "123456", "Diretor"]);
                }
            });
        });
    }
});

// --- ROTAS DE AUTENTICAÇÃO ---
app.post('/api/login', (req, res) => {
    const { acesso, senha, perfil } = req.body;
    db.get(`SELECT id, nome, perfil FROM usuarios WHERE acesso = ? AND senha = ? AND perfil = ?`, [acesso, senha, perfil], (err, user) => {
        if (user) res.json({ success: true, user });
        else res.status(401).json({ success: false, message: "Credenciais incorretas." });
    });
});

// --- ROTAS DA DIRETORIA ---
app.post('/api/professores', (req, res) => {
    const { nome, acesso, senha } = req.body;
    db.run("INSERT INTO usuarios (nome, acesso, senha, perfil) VALUES (?, ?, ?, 'Professor')", [nome, acesso, senha], function(err) {
        if (err) res.status(500).json({ success: false, error: "Este acesso já existe para outro usuário." });
        else res.json({ success: true });
    });
});

app.get('/api/professores', (req, res) => {
    db.all("SELECT id, nome, acesso FROM usuarios WHERE perfil = 'Professor' ORDER BY nome", [], (err, rows) => res.json(rows));
});

app.post('/api/turmas', (req, res) => {
    db.run("INSERT INTO turmas (nome) VALUES (?)", [req.body.nome], function(err) {
        if (err) res.status(500).json({ success: false });
        else res.json({ success: true });
    });
});

app.get('/api/turmas', (req, res) => {
    db.all("SELECT * FROM turmas ORDER BY nome", [], (err, rows) => res.json(rows));
});

// CORREÇÃO: Validação para impedir duplicação de aluno na mesma turma
app.post('/api/alunos', (req, res) => {
    const { nome, turma_id } = req.body;
    
    db.get("SELECT id FROM alunos WHERE LOWER(nome) = LOWER(?) AND turma_id = ?", [nome.trim(), turma_id], (err, row) => {
        if (row) {
            return res.status(400).json({ success: false, error: "Este aluno já está cadastrado nesta turma!" });
        }
        
        db.run("INSERT INTO alunos (nome, turma_id) VALUES (?, ?)", [nome.trim(), turma_id], function(err) {
            if (err) res.status(500).json({ success: false, error: "Erro interno do servidor." });
            else res.json({ success: true });
        });
    });
});

app.get('/api/alunos/geral', (req, res) => {
    db.all(`SELECT a.id, a.nome as aluno_nome, t.nome as turma_nome FROM alunos a LEFT JOIN turmas t ON a.turma_id = t.id ORDER BY t.nome, a.nome`, [], (err, rows) => res.json(rows));
});

// --- ROTAS DO PROFESSOR ---
app.get('/api/turmas/:id/alunos', (req, res) => {
    db.all("SELECT * FROM alunos WHERE turma_id = ? ORDER BY nome", [req.params.id], (err, rows) => res.json(rows));
});

app.post('/api/chamadas', (req, res) => {
    const { turma_id, data, presencas } = req.body;
    db.run("INSERT INTO chamadas (turma_id, data) VALUES (?, ?)", [turma_id, data], function(err) {
        if (err) return res.status(500).json({ success: false });
        const llamada_id = this.lastID;
        const stmt = db.prepare("INSERT INTO presencas (chamada_id, aluno_id, status) VALUES (?, ?, ?)");
        presencas.forEach(p => stmt.run(llamada_id, p.aluno_id, p.status));
        stmt.finalize();
        res.json({ success: true });
    });
});

app.get('/api/relatorios/turma/:id', (req, res) => {
    const sql = `
        SELECT a.id, a.nome, 
        COUNT(CASE WHEN p.status = 'Presente' THEN 1 END) as presencas,
        COUNT(CASE WHEN p.status = 'Ausente' THEN 1 END) as ausencias,
        COUNT(CASE WHEN p.status = 'Justificado' THEN 1 END) as justificadas,
        COUNT(p.id) as total_aulas
        FROM alunos a 
        LEFT JOIN presencas p ON a.id = p.aluno_id 
        WHERE a.turma_id = ? 
        GROUP BY a.id ORDER BY a.nome
    `;
    db.all(sql, [req.params.id], (err, rows) => res.json(rows));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/professor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'professor.html')));
app.get('/diretor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'diretor.html')));

app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));