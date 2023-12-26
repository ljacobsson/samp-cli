const parser = require('../../shared/parser');
const fs = require('fs');
const yaml = require('yaml');
const inputUtil = require('../../shared/inputUtil');
const { execSync } = require("child_process");
const { last } = require('lodash');

async function run(cmd) {
    const template = await parser.findSAMTemplateFile(process.cwd());
    const templateContent = fs.readFileSync(template, 'utf8');
    const parsedTemplate = parser.parse("template", templateContent);

    if (parser.format['template'] !== 'yaml') {
        console.log("SAM template must be in YAML format");
        process.exit(1);
    }
    // Parse the YAML content
    const resources = Object.keys(parsedTemplate.Resources).map(p => { return { value: p } });
    let lastResource = null;
    for( let resource of resources) {
        const occurrences = findResourceOccurrences(templateContent, resource.value, lastResource);
        resource.children = occurrences.map(o => { return { value: o.lineNumber, name: o.isResource ? resource.value : o.parentResource } });
        console.log(occurrences);
    }

    const resource = await inputUtil.tree("Select resource", resources);
}

function findResourceOccurrences(yamlString, resourceName, lastResource) {
    const lines = yamlString.split('\n');
    const occurrences = [];
    let currentResource = null;
    lines.forEach((line, index) => {
        if (line.trim().startsWith(resourceName + ':')) {
            occurrences.push({ lineNumber: index + 1, isResource: true });
            currentResource = resourceName;
            lastResource = resourceName;
        } else if (line.trim().startsWith('Type:')) {
            currentResource = null;
        } else if (line.includes(resourceName)) {
            occurrences.push({ lineNumber: index + 1, parentResource: lastResource });
        }
    });

    return occurrences;
}

function countLeadingSpaces(line) {
    return line.search(/\S|$/);
}


module.exports = {
    run
}