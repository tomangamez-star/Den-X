class Workspace{

    constructor(){

        this.isLandscape = false;

    }

    enter(){

        document.body.classList.add("workspace-mode");

        this.isLandscape = true;

    }

    exit(){

        document.body.classList.remove("workspace-mode");

        this.isLandscape = false;

    }

}

const workspaceManager = new Workspace();