// script.js

// Aplica o tema salvo assim que a página carrega
document.addEventListener("DOMContentLoaded", () => {
    const temaSalvo = localStorage.getItem("tema") || "dark";
    if (temaSalvo === "light") {
        document.body.classList.add("light-mode");
    }
});

function alternarTema() {
    if (document.body.classList.contains("light-mode")) {
        document.body.classList.remove("light-mode");
        localStorage.setItem("tema", "dark");
    } else {
        document.body.classList.add("light-mode");
        localStorage.setItem("tema", "light");
    }
}

function selecionarPerfil(perfil) {
    document.body.classList.add('fade-out');
    localStorage.setItem('perfilAtivo', perfil);
    setTimeout(() => { window.location.href = '/login'; }, 400); 
}